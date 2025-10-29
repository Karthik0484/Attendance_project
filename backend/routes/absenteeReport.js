import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import ClassAssignment from '../models/ClassAssignment.js';
import moment from 'moment-timezone';
import mongoose from 'mongoose';

const router = express.Router();

// @desc    Generate absentee report (single day or date range)
// @route   GET /api/reports/absentee
// @access  Faculty and above
router.get('/absentee', authenticate, async (req, res) => {
  try {
    const { classId, batch, year, semester, section, date, startDate, endDate } = req.query;
    const currentUser = req.user;

    console.log('📊 Absentee report request:', { classId, batch, year, semester, section, date, startDate, endDate });

    // Try to find class assignment
    let classAssignment;
    
    // If we have batch, year, semester, section, use those to find the class
    if (batch && year && semester && section) {
      // Parse semester - handle both "Sem 1" and "1" formats
      let semesterNum = semester;
      if (typeof semester === 'string' && semester.includes('Sem')) {
        semesterNum = parseInt(semester.replace('Sem ', ''));
      } else {
        semesterNum = parseInt(semester);
      }
      
      console.log('📊 Looking for class:', { batch, year, semester: semesterNum, section });
      
      // First, try to find ANY class assignment matching these details (regardless of who it's assigned to)
      classAssignment = await ClassAssignment.findOne({
        batch,
        year,
        semester: semesterNum,
        section
      }).sort({ assignedDate: -1 }); // Get the most recent one
      
      console.log('📊 Found by class details:', classAssignment ? 'Yes' : 'No');
      if (classAssignment) {
        console.log('📊 Found assignment:', {
          id: classAssignment._id,
          batch: classAssignment.batch,
          year: classAssignment.year,
          semester: classAssignment.semester,
          section: classAssignment.section,
          facultyId: classAssignment.facultyId,
          status: classAssignment.status,
          active: classAssignment.active
        });
      } else {
        // Debug: Let's see what classes exist
        const allClasses = await ClassAssignment.find({}).limit(5);
        console.log('📊 Sample classes in database:', allClasses.map(c => ({
          batch: c.batch,
          year: c.year,
          semester: c.semester,
          section: c.section
        })));
      }
    }
    
    // Fallback: try to find by classId if it's a valid ObjectId
    if (!classAssignment && classId) {
      try {
        classAssignment = await ClassAssignment.findById(classId);
        console.log('📊 Found by ID:', classAssignment ? 'Yes' : 'No');
      } catch (err) {
        console.log('📊 ClassId is not a valid ObjectId, skipping ID lookup');
      }
    }
    
    if (!classAssignment) {
      return res.status(404).json({
        success: false,
        message: 'Class not found. Please provide valid class details.'
      });
    }

    // Check if user is authorized (faculty assigned to this class, HOD, or admin)
    const isFacultyAssigned = classAssignment.facultyId.toString() === currentUser._id.toString();
    const isHODOrAdmin = ['hod', 'admin', 'principal'].includes(currentUser.role);
    
    console.log('📊 Authorization check:', {
      facultyId: classAssignment.facultyId.toString(),
      userId: currentUser._id.toString(),
      userRole: currentUser.role,
      isFacultyAssigned,
      isHODOrAdmin
    });

    if (!isFacultyAssigned && !isHODOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this class report'
      });
    }

    // Determine report type
    let reportType, queryStartDate, queryEndDate, displayDate;

    if (date) {
      // Single-day report
      reportType = 'single-day';
      queryStartDate = moment.tz(date, 'Asia/Kolkata').startOf('day').toDate();
      queryEndDate = moment.tz(date, 'Asia/Kolkata').endOf('day').toDate();
      displayDate = moment.tz(date, 'Asia/Kolkata').format('DD MMMM YYYY');
      
      console.log('📅 Single-day report for:', displayDate);
    } else if (startDate && endDate) {
      // Date range report
      reportType = 'range';
      queryStartDate = moment.tz(startDate, 'Asia/Kolkata').startOf('day').toDate();
      queryEndDate = moment.tz(endDate, 'Asia/Kolkata').endOf('day').toDate();
      
      // Validate date range
      if (queryStartDate > queryEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date'
        });
      }

      // Limit to 6 months
      const monthsDiff = moment(queryEndDate).diff(moment(queryStartDate), 'months', true);
      if (monthsDiff > 6) {
        return res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 6 months'
        });
      }

      displayDate = `${moment.tz(startDate, 'Asia/Kolkata').format('DD MMM YYYY')} to ${moment.tz(endDate, 'Asia/Kolkata').format('DD MMM YYYY')}`;
      
      console.log('📅 Range report:', displayDate);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a date or startDate and endDate'
      });
    }

    // Fetch all students in this class - try multiple approaches
    console.log('🔍 Looking for students with class:', {
      batch: classAssignment.batch,
      year: classAssignment.year,
      semester: classAssignment.semester,
      section: classAssignment.section,
      department: currentUser.department
    });

    // Build the classId that matches attendance records
    const attendanceClassId = `${classAssignment.batch}_${classAssignment.year}_Sem ${classAssignment.semester}_${classAssignment.section}`;
    
    console.log('🔍 Looking for students in class:', attendanceClassId);
    console.log('🔍 Class details:', {
      batch: classAssignment.batch,
      year: classAssignment.year,
      semester: classAssignment.semester,
      section: classAssignment.section,
      department: currentUser.department
    });
    
    // Try ALL strategies and combine results (use Set to avoid duplicates)
    const studentMap = new Map();
    
    // Strategy 1: Try with batchYear, year, and section
    console.log('\n📍 Strategy 1: Searching with batchYear + year + section...');
    const strategy1Students = await Student.find({
      batchYear: classAssignment.batch,
      year: classAssignment.year,
      section: classAssignment.section
    }).select('regNo rollNumber name parentContact email currentSemester department semesters status batchYear section classId');
    
    console.log(`  ✓ Found ${strategy1Students.length} students`);
    strategy1Students.forEach(s => studentMap.set(s._id.toString(), s));
    
    // Strategy 2: Try with legacy classId field
    console.log('\n📍 Strategy 2: Searching with classId...');
    const strategy2Students = await Student.find({
      classId: attendanceClassId
    }).select('regNo rollNumber name parentContact email currentSemester department semesters status batchYear section classId');
    
    console.log(`  ✓ Found ${strategy2Students.length} students`);
    strategy2Students.forEach(s => studentMap.set(s._id.toString(), s));
    
    // Strategy 3: Check semesters array (new multi-semester model)
    console.log('\n📍 Strategy 3: Searching in semesters array...');
    const semesterName = `Sem ${classAssignment.semester}`;
    const strategy3Students = await Student.find({
      department: currentUser.department,
      'semesters.semesterName': semesterName,
      'semesters.year': classAssignment.year,
      'semesters.section': classAssignment.section,
      'semesters.batch': classAssignment.batch
    }).select('regNo rollNumber name parentContact email currentSemester department semesters status batchYear section classId');
    
    console.log(`  ✓ Found ${strategy3Students.length} students`);
    strategy3Students.forEach(s => studentMap.set(s._id.toString(), s));
    
    // Strategy 4: Fallback - find by department, year and check classId pattern
    console.log('\n📍 Strategy 4: Broad search by department + year...');
    const strategy4Students = await Student.find({
      department: currentUser.department,
      year: classAssignment.year
    }).select('regNo rollNumber name parentContact email currentSemester department semesters status batchYear section classId');
    
    console.log(`  ✓ Found ${strategy4Students.length} students (unfiltered)`);
    
    // Filter by classId if they have it
    const filteredStrategy4 = strategy4Students.filter(s => {
      if (s.classId && s.classId === attendanceClassId) {
        return true;
      }
      // Also check semesters array
      if (s.semesters && s.semesters.length > 0) {
        return s.semesters.some(sem => 
          sem.batch === classAssignment.batch &&
          sem.year === classAssignment.year &&
          sem.semesterName === semesterName &&
          sem.section === classAssignment.section
        );
      }
      return false;
    });
    
    console.log(`  ✓ After filtering: ${filteredStrategy4.length} students`);
    filteredStrategy4.forEach(s => studentMap.set(s._id.toString(), s));
    
    // Convert Map back to array
    let students = Array.from(studentMap.values());
    
    console.log('\n🎯 TOTAL UNIQUE STUDENTS FOUND:', students.length);
    
    if (students.length > 0) {
      console.log('\n📋 List of all students found:');
      students.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.name} (${s.rollNumber || s.regNo}) - classId: ${s.classId || 'N/A'}, section: ${s.section || 'N/A'}, status: ${s.status}`);
      });
      
      console.log('\n✅ Successfully found', students.length, 'students for class:', attendanceClassId);
    } else {
      console.log('\n⚠️ WARNING: No students found for this class!');
      console.log('⚠️ This will result in incorrect totals in the report.');
      
      // Show what's available in database
      console.log('\n🔍 Debug: Checking all students in department...');
      const allDeptStudents = await Student.find({
        department: currentUser.department
      }).limit(20).select('regNo rollNumber name classId batchYear year section semesters');
      
      console.log(`📊 Total students in ${currentUser.department} department: ${allDeptStudents.length} (showing first 20)`);
      allDeptStudents.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.name} - classId: ${s.classId}, year: ${s.year}, section: ${s.section}, semesters: ${s.semesters?.length || 0}`);
      });
    }

    console.log('\n👥 From Student model query:', students.length, 'students');
    console.log('📌 Note: Will use attendance records for accurate total count');

    // Don't return early if no students found - attendance records have the truth!
    // We'll get student details from attendance.records instead

    const studentIds = students.map(s => s._id);

    console.log('🔍 Query details:', {
      studentCount: studentIds.length,
      dateRange: {
        start: queryStartDate,
        end: queryEndDate
      },
      lookingForStatus: 'absent'
    });

    // Use the attendanceClassId already built earlier for student search
    console.log('🔍 Looking for attendance with classId:', attendanceClassId);
    console.log('🔍 Date range:', { start: queryStartDate, end: queryEndDate });

    // Convert date range to YYYY-MM-DD strings for comparison
    const startDateStr = moment.tz(date || startDate, 'Asia/Kolkata').format('YYYY-MM-DD');
    const endDateStr = moment.tz(date || endDate || date || startDate, 'Asia/Kolkata').format('YYYY-MM-DD');
    
    console.log('🔍 Date strings:', { startDateStr, endDateStr });

    // Query: Find Attendance documents for this class and date(s)
    const query = {
      classId: attendanceClassId
    };
    
    if (reportType === 'single-day') {
      query.date = startDateStr; // Exact match for single day
    } else {
      query.date = {
        $gte: startDateStr,
        $lte: endDateStr
      };
    }
    
    console.log('🔍 Attendance query:', JSON.stringify(query, null, 2));
    
    const attendanceDocs = await Attendance.find(query).sort({ date: 1 });
    
    console.log('📋 Found attendance documents:', attendanceDocs.length);
    
    // Get total student count from attendance records (most accurate!)
    let totalStudentsFromAttendance = 0;
    if (attendanceDocs.length > 0) {
      // Use the first attendance document to get total students
      // All attendance docs for the same class should have the same students
      totalStudentsFromAttendance = attendanceDocs[0].records?.length || 0;
      console.log('✅ Total students from attendance records:', totalStudentsFromAttendance);
      
      // Override the students array count with attendance-based count
      if (totalStudentsFromAttendance > 0) {
        console.log('📊 Using attendance records as source of truth for total student count');
        console.log(`   Previously queried: ${students.length} students`);
        console.log(`   Attendance shows: ${totalStudentsFromAttendance} students`);
      }
    }
    
    // If no attendance found, return early with appropriate message
    if (attendanceDocs.length === 0) {
      console.log('⚠️ No attendance records found for this date/range!');
      
      return res.json({
        success: true,
        reportType,
        date: displayDate,
        rawDate: date || null,
        rawStartDate: startDate || null,
        rawEndDate: endDate || null,
        classInfo: {
          id: classAssignment._id,
          batch: classAssignment.batch,
          year: classAssignment.year,
          semester: classAssignment.semester,
          section: classAssignment.section,
          classDisplay: `${classAssignment.batch} | ${classAssignment.year} | Sem ${classAssignment.semester} | Sec ${classAssignment.section}`
        },
        totalStudents: 0,
        totalAbsentees: 0,
        absentees: [],
        message: 'No attendance records found for this date. Please mark attendance first.',
        generatedAt: moment().tz('Asia/Kolkata').format('DD MMM YYYY, hh:mm A'),
        generatedBy: {
          name: currentUser.name,
          email: currentUser.email
        }
      });
    }

    // Extract absent students from the records array inside each document
    let absentStudentRecords = [];
    
    attendanceDocs.forEach(doc => {
      console.log(`📋 Processing date ${doc.date}:`, {
        totalRecords: doc.records?.length || 0,
        status: doc.status
      });
      
      if (doc.records && doc.records.length > 0) {
        const absentsInDoc = doc.records.filter(record => record.status === 'absent');
        console.log(`  📋 Absentees on ${doc.date}:`, absentsInDoc.length);
        
        absentsInDoc.forEach(record => {
          absentStudentRecords.push({
            ...record.toObject(),
            date: doc.date,
            docId: doc._id
          });
        });
      }
    });

    console.log('📋 Total absent records found:', absentStudentRecords.length);

    // Process absentee data
    let absenteesData = [];

    if (reportType === 'single-day') {
      // Single-day report: list each absent student once
      absenteesData = absentStudentRecords.map(record => {
        // Find student by rollNumber (Student model uses 'rollNumber' field)
        const student = students.find(s => 
          (s.rollNumber === record.rollNumber) || (s.regNo === record.rollNumber)
        );
        
        return {
          regNo: record.rollNumber,
          name: record.name,
          email: record.email || 'N/A',
          parentContact: student?.parentContact || 'N/A',
          reason: record.reason || 'Not submitted',
          facultyAction: record.facultyNote || 'Pending review',
          reasonSubmitted: record.reasonSubmittedAt ? 
            moment(record.reasonSubmittedAt).tz('Asia/Kolkata').format('DD MMM YYYY, hh:mm A') : 
            null,
          date: moment(record.date, 'YYYY-MM-DD').tz('Asia/Kolkata').format('DD MMM YYYY')
        };
      });
    } else {
      // Range report: group by student and count days absent
      const studentAbsenceMap = new Map();

      absentStudentRecords.forEach(record => {
        const rollNumber = record.rollNumber;
        if (!studentAbsenceMap.has(rollNumber)) {
          studentAbsenceMap.set(rollNumber, {
            name: record.name,
            email: record.email,
            dates: [],
            reasons: []
          });
        }
        
        const data = studentAbsenceMap.get(rollNumber);
        data.dates.push(moment(record.date, 'YYYY-MM-DD').tz('Asia/Kolkata').format('DD MMM'));
        
        if (record.reason) {
          data.reasons.push({
            date: moment(record.date, 'YYYY-MM-DD').tz('Asia/Kolkata').format('DD MMM'),
            reason: record.reason,
            action: record.facultyNote
          });
        }
      });

      absenteesData = Array.from(studentAbsenceMap.entries()).map(([rollNumber, data]) => {
        // Find student by rollNumber (Student model uses 'rollNumber' field)
        const student = students.find(s => 
          (s.rollNumber === rollNumber) || (s.regNo === rollNumber)
        );
        
        return {
          regNo: rollNumber,
          name: data.name,
          email: data.email || 'N/A',
          parentContact: student?.parentContact || 'N/A',
          daysAbsent: data.dates.length,
          absentDates: data.dates.join(', '),
          reasons: data.reasons.length > 0 ? 
            data.reasons.map(r => `${r.date}: ${r.reason}`).join(' | ') : 
            'Not submitted',
          facultyActions: data.reasons.length > 0 ?
            data.reasons.map(r => `${r.date}: ${r.action || 'Pending'}`).join(' | ') :
            'Pending review'
        };
      });

      // Sort by days absent (descending)
      absenteesData.sort((a, b) => b.daysAbsent - a.daysAbsent);
    }

    console.log('✅ Absentees processed:', absenteesData.length);

    res.json({
      success: true,
      reportType,
      date: displayDate,
      rawDate: date || null,
      rawStartDate: startDate || null,
      rawEndDate: endDate || null,
      classInfo: {
        id: classAssignment._id,
        batch: classAssignment.batch,
        year: classAssignment.year,
        semester: classAssignment.semester,
        section: classAssignment.section,
        classDisplay: `${classAssignment.batch} | ${classAssignment.year} | Sem ${classAssignment.semester} | Sec ${classAssignment.section}`
      },
      totalStudents: totalStudentsFromAttendance > 0 ? totalStudentsFromAttendance : students.length,
      totalAbsentees: absenteesData.length,
      absentees: absenteesData,
      generatedAt: moment().tz('Asia/Kolkata').format('DD MMM YYYY, hh:mm A'),
      generatedBy: {
        name: currentUser.name,
        email: currentUser.email
      }
    });

  } catch (error) {
    console.error('❌ Error generating absentee report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating report',
      error: error.message
    });
  }
});

// @desc    Update absentee report records (edit parent contact, reason, faculty action)
// @route   PUT /api/reports/absentee
// @access  Faculty (must be assigned to class)
router.put('/absentee', authenticate, async (req, res) => {
  try {
    const { classId, batch, year, semester, section, updates } = req.body;
    const currentUser = req.user;

    console.log('📝 Report update request:', { classId, batch, year, semester, section, updatesCount: updates?.length });

    // Validation
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    // Find class assignment
    let classAssignment;
    if (batch && year && semester && section) {
      const semesterNum = typeof semester === 'string' && semester.includes('Sem') 
        ? parseInt(semester.replace('Sem ', '')) 
        : parseInt(semester);

      classAssignment = await ClassAssignment.findOne({
        batch,
        year,
        semester: semesterNum,
        section
      });
    } else if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      classAssignment = await ClassAssignment.findById(classId);
    }

    if (!classAssignment) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Authorization check: Faculty must be assigned to this class OR be HOD/Admin
    const isAssignedFaculty = classAssignment.facultyId.toString() === currentUser._id.toString();
    const isHODOrAdmin = ['hod', 'admin'].includes(currentUser.role);

    if (!isAssignedFaculty && !isHODOrAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this report'
      });
    }

    console.log('✅ Authorization passed');

    // Process updates in batches
    const updateResults = {
      success: [],
      failed: [],
      totalProcessed: 0
    };

    // Build attendanceClassId
    const attendanceClassId = `${classAssignment.batch}_${classAssignment.year}_Sem ${classAssignment.semester}_${classAssignment.section}`;

    for (const update of updates) {
      try {
        const { regNo, date, parentContact, reason, facultyAction } = update;

        if (!regNo || !date) {
          updateResults.failed.push({
            regNo,
            date,
            reason: 'Missing required fields (regNo or date)'
          });
          continue;
        }

        // Validate inputs
        if (parentContact && parentContact !== 'N/A') {
          if (!/^[0-9]{10}$/.test(parentContact.replace(/\s/g, ''))) {
            updateResults.failed.push({
              regNo,
              date,
              reason: 'Invalid parent contact format (must be 10 digits)'
            });
            continue;
          }
        }

        if (reason && reason.length > 500) {
          updateResults.failed.push({
            regNo,
            date,
            reason: 'Reason exceeds maximum length (500 characters)'
          });
          continue;
        }

        // Convert date to YYYY-MM-DD format
        const dateStr = moment(date).format('YYYY-MM-DD');

        // Find the attendance document for this date and class
        const attendanceDoc = await Attendance.findOne({
          classId: attendanceClassId,
          date: dateStr
        });

        if (!attendanceDoc) {
          updateResults.failed.push({
            regNo,
            date: dateStr,
            reason: 'Attendance record not found for this date'
          });
          continue;
        }

        // Find the specific student record within the attendance document
        const studentRecord = attendanceDoc.records.find(r => r.rollNumber === regNo);

        if (!studentRecord) {
          updateResults.failed.push({
            regNo,
            date: dateStr,
            reason: 'Student record not found in attendance'
          });
          continue;
        }

        // Update the editable fields
        let wasUpdated = false;

        if (reason !== undefined && reason !== studentRecord.reason) {
          studentRecord.reason = reason;
          studentRecord.reasonSubmittedAt = new Date();
          wasUpdated = true;
        }

        if (facultyAction !== undefined && facultyAction !== studentRecord.facultyNote) {
          studentRecord.facultyNote = facultyAction;
          studentRecord.facultyActionAt = new Date();
          wasUpdated = true;
        }

        // Store audit trail
        if (wasUpdated) {
          if (!studentRecord.editHistory) {
            studentRecord.editHistory = [];
          }
          
          studentRecord.editHistory.push({
            editedBy: currentUser._id,
            editedByName: currentUser.name,
            editedAt: new Date(),
            changes: {
              reason: reason !== undefined ? { old: studentRecord.reason, new: reason } : undefined,
              facultyAction: facultyAction !== undefined ? { old: studentRecord.facultyNote, new: facultyAction } : undefined
            }
          });

          // Save the attendance document
          await attendanceDoc.save();

          // Update parent contact in Student model if provided
          if (parentContact && parentContact !== 'N/A') {
            await Student.findOneAndUpdate(
              { rollNumber: regNo },
              { 
                parentContact,
                updatedAt: new Date()
              }
            );
          }

          updateResults.success.push({
            regNo,
            date: dateStr,
            message: 'Updated successfully'
          });
        } else {
          updateResults.success.push({
            regNo,
            date: dateStr,
            message: 'No changes detected'
          });
        }

        updateResults.totalProcessed++;

      } catch (updateError) {
        console.error(`❌ Error updating record for ${update.regNo}:`, updateError);
        updateResults.failed.push({
          regNo: update.regNo,
          date: update.date,
          reason: updateError.message
        });
      }
    }

    console.log('✅ Update results:', {
      total: updates.length,
      processed: updateResults.totalProcessed,
      successful: updateResults.success.length,
      failed: updateResults.failed.length
    });

    // Return results
    res.json({
      success: true,
      message: `Updated ${updateResults.success.length} of ${updates.length} records`,
      data: updateResults,
      updatedBy: {
        name: currentUser.name,
        email: currentUser.email
      },
      updatedAt: moment().tz('Asia/Kolkata').format('DD MMM YYYY, hh:mm A')
    });

  } catch (error) {
    console.error('❌ Error updating absentee report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating report',
      error: error.message
    });
  }
});

export default router;


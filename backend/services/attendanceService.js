/**
 * Attendance Management Service
 * Handles all attendance operations with data integrity and validation
 */

import mongoose from 'mongoose';
import ClassAttendance from '../models/ClassAttendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { getISTDate, normalizeDateToUTC } from '../utils/dateUtils.js';
import { getStudentsProgressive } from './progressiveStudentQueryService.js';
import { getFacultyClassAssignment } from './facultyClassMappingService.js';
import { getHolidaysForClass, isHoliday, getHolidayCountForAnalytics } from './holidayService.js';

/**
 * Mark attendance for a class on a specific date
 */
export async function markAttendance(options) {
  const { facultyId, classId, date, absentStudents, notes } = options;
  
  try {
    console.log('📝 Marking attendance:', { facultyId, classId, date, absentStudents, absentCount: absentStudents?.length || 0 });
    
    // Parse the date and normalize to UTC midnight
    const attendanceDate = new Date(date);
    const normalizedDate = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate());
    
    console.log('📅 Date processing:', {
      originalDate: date,
      parsedDate: attendanceDate,
      normalizedDate: normalizedDate
    });
    
    // Get class information and validate faculty authorization
    const classInfo = await getClassInfo(classId, facultyId);
    if (!classInfo.success) {
      return { success: false, error: classInfo.error };
    }
    
    // Parse classId to get class context
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return {
        success: false,
        error: {
          message: 'Invalid classId format',
          code: 'INVALID_CLASS_ID'
        }
      };
    }
    
    const [batch, year, semester, section] = parts;
    const classContext = {
      batch,
      year,
      semester,
      section,
      department: classInfo.data.department
    };

    // Check if the date is a holiday
    const holidayCheck = await isHoliday({
      date: normalizedDate,
      batchYear: batch,
      section: section,
      semester: semester,
      department: classContext.department
    });

    if (holidayCheck.success && holidayCheck.data.isHoliday) {
      return {
        success: false,
        error: {
          message: `Cannot mark attendance on ${holidayCheck.data.holiday.reason} (Holiday)`,
          code: 'HOLIDAY_DATE',
          holiday: holidayCheck.data.holiday
        }
      };
    }
    
    // Get students using the same method as frontend display
    const constructedClassId = `${classContext.batch}_${classContext.year}_${classContext.semester}_${classContext.section}`;
    
    // Query students that have the specific semester enrollment (same as getStudentsForFaculty)
    const query = {
      department: classContext.department,
      batchYear: classContext.batch,
      section: classContext.section,
      'semesters.semesterName': classContext.semester,
      'semesters.year': classContext.year,
      'semesters.classId': constructedClassId,
      'semesters.status': 'active',
      status: 'active'
    };

    console.log('🔍 Attendance validation query:', JSON.stringify(query, null, 2));

    const students = await Student.find(query)
      .select('_id rollNumber name email batch year semester section department')
      .sort({ rollNumber: 1 });
    
    if (students.length === 0) {
      return {
        success: false,
        error: {
          message: 'No students found in this class',
          code: 'NO_STUDENTS'
        }
      };
    }
    
    console.log(`✅ Retrieved ${students.length} students for class: ${constructedClassId}`);
    console.log('Students:', students.map(s => ({ id: s._id, rollNumber: s.rollNumber, name: s.name })));
    
    // Ensure absentStudents is an array
    const absentStudentsArray = Array.isArray(absentStudents) ? absentStudents : [];
    
    // Validate absent students and create student objects
    console.log('🔍 Validating absent students:', { absentStudents: absentStudentsArray, studentsCount: students.length });
    
    const allRollNumbers = students.map(s => s.rollNumber);
    const invalidRollNumbers = [];
    const validAbsentStudents = [];
    const seen = new Set();
    
    // Validate each absent student roll number
    for (const rollNumber of absentStudentsArray) {
      if (!allRollNumbers.includes(rollNumber)) {
        invalidRollNumbers.push(rollNumber);
      } else if (seen.has(rollNumber)) {
        // Skip duplicates
        continue;
      } else {
        seen.add(rollNumber);
        // Find the student object for this roll number
        const student = students.find(s => s.rollNumber === rollNumber);
        if (student) {
          validAbsentStudents.push({
            studentId: student._id,
            rollNumber: student.rollNumber,
            name: student.name
          });
        }
      }
    }
    
    if (invalidRollNumbers.length > 0) {
      return {
        success: false,
        error: {
          message: 'Invalid roll numbers not found in class',
          code: 'INVALID_ROLL_NUMBERS',
          details: invalidRollNumbers
        }
      };
    }
    
    // Calculate present students (all students not in absent list)
    const absentRollNumbers = validAbsentStudents.map(s => s.rollNumber);
    const presentStudents = students
      .filter(student => !absentRollNumbers.includes(student.rollNumber))
      .map(student => ({
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name
      }));
    
    console.log('📊 Student counts:', {
      total: students.length,
      present: presentStudents.length,
      absent: validAbsentStudents.length,
      presentStudents: presentStudents.map(s => s.rollNumber),
      absentStudents: validAbsentStudents.map(s => s.rollNumber)
    });
    
    // Check if attendance already exists for this class and date
    console.log('🔍 Checking for existing attendance record...');
    console.log('🔍 Search criteria:', {
      facultyId: facultyId,
      classAssigned: classId,
      department: classInfo.data.department,
      date: normalizedDate
    });
    
    const existingAttendance = await ClassAttendance.findOne({
      facultyId: facultyId,
      classAssigned: classId,
      department: classInfo.data.department,
      date: normalizedDate
    });

    console.log('🔍 Existing attendance found:', !!existingAttendance);
    if (existingAttendance) {
      console.log('⚠️ Attendance already marked for today:', {
        id: existingAttendance._id,
        classAssigned: existingAttendance.classAssigned,
        department: existingAttendance.department,
        date: existingAttendance.date
      });
      return {
        success: false,
        error: {
          message: 'Attendance has already been marked for this class today. You can only mark attendance once per day.',
          code: 'ATTENDANCE_ALREADY_EXISTS',
          existingRecord: {
            id: existingAttendance._id,
            date: existingAttendance.date,
            totalStudents: existingAttendance.totalStudents,
            totalPresent: existingAttendance.totalPresent,
            totalAbsent: existingAttendance.totalAbsent
          }
        }
      };
    }

    // Create new attendance record (only one per day per class)
    console.log('📝 Creating new attendance record');
    
    // Generate a unique session ID for this attendance marking
    const sessionId = `${classId}_${normalizedDate.toISOString().split('T')[0]}_${Date.now()}`;
    let attendanceRecord = new ClassAttendance({
        facultyId: facultyId,
        classId: classId, // Use original classId since only one record per day
        classAssigned: classId, // Use original classId since only one record per day
        originalClassId: classId, // Store original classId for easy querying
        date: normalizedDate,
        sessionId: sessionId, // Unique identifier for this attendance session
        presentStudents: presentStudents.map(s => s.rollNumber), // Store roll numbers for compatibility
        absentStudents: validAbsentStudents.map(s => s.rollNumber), // Store roll numbers for compatibility
        totalStudents: students.length,
        totalPresent: presentStudents.length,
        totalAbsent: validAbsentStudents.length,
        batch: classInfo.data.batch,
        year: classInfo.data.year,
        semester: classInfo.data.semester,
        section: classInfo.data.section,
        department: classInfo.data.department,
        createdBy: facultyId,
        updatedBy: facultyId,
        status: 'finalized',
        notes: notes || ''
      });
      
    try {
      attendanceRecord = await attendanceRecord.save();
      console.log('✅ New attendance record created successfully');
    } catch (error) {
      console.error('❌ Error saving attendance record:', error);
      
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        console.log('⚠️ Duplicate key error detected, checking for existing record...');
        
        // Try to find the existing record
        const existingRecord = await ClassAttendance.findOne({
          facultyId: facultyId,
          classAssigned: classId,
          department: classInfo.data.department,
          date: normalizedDate
        });
        
        if (existingRecord) {
          return {
            success: false,
            error: {
              message: 'Attendance has already been marked for this class today. You can only mark attendance once per day.',
              code: 'ATTENDANCE_ALREADY_EXISTS',
              existingRecord: {
                id: existingRecord._id,
                date: existingRecord.date,
                totalStudents: existingRecord.totalStudents,
                totalPresent: existingRecord.totalPresent,
                totalAbsent: existingRecord.totalAbsent
              }
            }
          };
        }
      }
      
      throw error;
    }
    
    console.log('✅ Attendance marked successfully:', {
      id: attendanceRecord._id,
      totalStudents: attendanceRecord.totalStudents,
      present: attendanceRecord.totalPresent,
      absent: attendanceRecord.totalAbsent,
      presentStudents: attendanceRecord.presentStudents,
      absentStudents: attendanceRecord.absentStudents
    });
    
    return {
      success: true,
      data: {
        attendance: attendanceRecord,
        students: students,
        summary: {
          totalStudents: attendanceRecord.totalStudents,
          totalPresent: attendanceRecord.totalPresent,
          totalAbsent: attendanceRecord.totalAbsent,
          attendancePercentage: attendanceRecord.attendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error marking attendance:', error);
    return {
      success: false,
      error: {
        message: 'Error marking attendance',
        details: error.message
      }
    };
  }
}

/**
 * Get attendance history for a class
 */
export async function getAttendanceHistory(options) {
  const { facultyId, classId, startDate, endDate, limit = 50, page = 1 } = options;
  
  try {
    console.log('📊 Getting attendance history:', { facultyId, classId, startDate, endDate });
    
    // Build query
    const query = { facultyId: facultyId, classId: classId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = normalizeDateToUTC(startDate);
      if (endDate) query.date.$lte = normalizeDateToUTC(endDate);
    }
    
    // Get attendance records
    const attendanceRecords = await ClassAttendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy updatedBy', 'name email');
    
    const total = await ClassAttendance.countDocuments(query);
    
    console.log(`✅ Found ${attendanceRecords.length} attendance records`);
    
    return {
      success: true,
      data: {
        records: attendanceRecords,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total: total
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting attendance history:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving attendance history',
        details: error.message
      }
    };
  }
}

/**
 * Get attendance details for a specific date
 */
export async function getAttendanceDetails(facultyId, classId, date) {
  try {
    console.log('📋 Getting attendance details:', { facultyId, classId, date });
    
    const normalizedDate = normalizeDateToUTC(date);
    
    const attendanceRecord = await ClassAttendance.findOne({
      facultyId: facultyId,
      classId: classId,
      date: normalizedDate
    });
    
    if (!attendanceRecord) {
      return {
        success: false,
        error: {
          message: 'No attendance record found for this date',
          code: 'NOT_FOUND'
        }
      };
    }
    
    // Get student details for present/absent lists
    const students = await Student.find({
      classId: classId,
      facultyId: facultyId,
      status: 'active'
    }).select('rollNumber name email');
    
    const presentStudents = students.filter(student => 
      attendanceRecord.presentStudents.includes(student.rollNumber)
    );
    
    const absentStudents = students.filter(student => 
      attendanceRecord.absentStudents.includes(student.rollNumber)
    );
    
    return {
      success: true,
      data: {
        attendance: attendanceRecord,
        presentStudents: presentStudents,
        absentStudents: absentStudents,
        summary: {
          totalStudents: attendanceRecord.totalStudents,
          totalPresent: attendanceRecord.totalPresent,
          totalAbsent: attendanceRecord.totalAbsent,
          attendancePercentage: attendanceRecord.attendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting attendance details:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving attendance details',
        details: error.message
      }
    };
  }
}

/**
 * Generate attendance report for a class
 */
export async function generateAttendanceReport(options) {
  const { facultyId, classId, startDate, endDate } = options;
  
  try {
    console.log('📊 Generating attendance report:', { facultyId, classId, startDate, endDate });
    
    // Parse classId to get class context
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return {
        success: false,
        error: {
          message: 'Invalid classId format',
          code: 'INVALID_CLASS_ID'
        }
      };
    }
    
    const [batch, year, semester, section] = parts;
    const classContext = {
      batch,
      year,
      semester,
      section,
      department: facultyId.department || 'CSE' // Assuming department is available
    };
    
    // Get holidays for the date range
    const holidayResult = await getHolidayCountForAnalytics({
      batchYear: batch,
      section: section,
      semester: semester,
      department: classContext.department,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0]
    });
    
    const holidays = holidayResult.success ? holidayResult.data.holidays : [];
    const workingDays = holidayResult.success ? holidayResult.data.workingDays : 0;
    const holidayCount = holidayResult.success ? holidayResult.data.holidayCount : 0;
    
    // Get all students in the class
    const students = await Student.find({
      classId: classId,
      facultyId: facultyId,
      status: 'active'
    }).select('rollNumber name email');
    
    if (students.length === 0) {
      return {
        success: false,
        error: {
          message: 'No students found in this class',
          code: 'NO_STUDENTS'
        }
      };
    }
    
    // Build date query
    const query = { facultyId: facultyId, classId: classId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = normalizeDateToUTC(startDate);
      if (endDate) query.date.$lte = normalizeDateToUTC(endDate);
    }
    
    // Get all attendance records
    const attendanceRecords = await ClassAttendance.find(query).sort({ date: 1 });
    
    // Calculate per-student statistics
    const studentReports = students.map(student => {
      let totalDays = 0;
      let absentDays = 0;
      
      attendanceRecords.forEach(record => {
        totalDays++;
        if (record.absentStudents.includes(student.rollNumber)) {
          absentDays++;
        }
      });
      
      const presentDays = totalDays - absentDays;
      // Calculate attendance percentage based on working days (excluding holidays)
      const attendancePercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100 * 100) / 100 : 0;
      
      return {
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        totalDays: totalDays,
        presentDays: presentDays,
        absentDays: absentDays,
        workingDays: workingDays,
        holidayDays: holidayCount,
        attendancePercentage: attendancePercentage
      };
    });
    
    // Calculate class statistics
    const totalDays = attendanceRecords.length;
    const totalPossibleAttendance = students.length * totalDays;
    const totalAbsentCount = attendanceRecords.reduce((sum, record) => sum + record.totalAbsent, 0);
    const totalPresentCount = totalPossibleAttendance - totalAbsentCount;
    const classAttendancePercentage = workingDays > 0 ? 
      Math.round((totalPresentCount / (students.length * workingDays)) * 100 * 100) / 100 : 0;
    
    console.log('✅ Attendance report generated successfully');
    
    return {
      success: true,
      data: {
        classInfo: {
          classId: classId,
          totalStudents: students.length,
          totalDays: totalDays,
          workingDays: workingDays,
          holidayDays: holidayCount,
          classAttendancePercentage: classAttendancePercentage
        },
        holidays: holidays,
        studentReports: studentReports,
        summary: {
          totalStudents: students.length,
          totalDays: totalDays,
          totalPresentCount: totalPresentCount,
          totalAbsentCount: totalAbsentCount,
          classAttendancePercentage: classAttendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error generating attendance report:', error);
    return {
      success: false,
      error: {
        message: 'Error generating attendance report',
        details: error.message
      }
    };
  }
}

/**
 * Check if attendance can be edited (within allowed time window)
 */
export function canEditAttendance(attendanceDate, editWindowDays = 7) {
  const today = new Date();
  const attendanceDateObj = new Date(attendanceDate);
  const daysDifference = Math.floor((today - attendanceDateObj) / (1000 * 60 * 60 * 24));
  
  return daysDifference <= editWindowDays;
}

/**
 * Get class information from classId
 */
async function getClassInfo(classId, facultyId) {
  try {
    // Parse classId to extract components
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return {
        success: false,
        error: {
          message: 'Invalid classId format',
          code: 'INVALID_CLASS_ID'
        }
      };
    }
    
    const [batch, year, semester, section] = parts;
    
    // Get faculty info
    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return {
        success: false,
        error: {
          message: 'Faculty not found',
          code: 'FACULTY_NOT_FOUND'
        }
      };
    }
    
    return {
      success: true,
      data: {
        batch: batch,
        year: year,
        semester: semester,
        section: section,
        department: faculty.department
      }
    };
    
  } catch (error) {
    console.error('Error getting class info:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving class information',
        details: error.message
      }
    };
  }
}


export default {
  markAttendance,
  getAttendanceHistory,
  getAttendanceDetails,
  generateAttendanceReport,
  canEditAttendance
};

import express from 'express';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @desc    Submit absence reason by student
// @route   POST /api/attendance/reason
// @access  Student
router.post('/reason', [
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { classId, date, studentId, reason } = req.body;

    console.log('📝 Student submitting absence reason:', { classId, date, studentId });

    // Get the Student document to find the actual student _id
    const Student = (await import('../models/Student.js')).default;
    let actualStudentId;
    
    // Check if studentId is a userId (from user collection) or actual student _id
    const studentByUserId = await Student.findOne({ userId: studentId });
    const studentById = await Student.findById(studentId);
    
    if (studentByUserId) {
      actualStudentId = studentByUserId._id;
      console.log('📝 Found student by userId:', actualStudentId);
    } else if (studentById) {
      actualStudentId = studentById._id;
      console.log('📝 Found student by _id:', actualStudentId);
    } else {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Find the attendance document for this class and date
    const attendanceDoc = await Attendance.findOne({ classId, date });

    if (!attendanceDoc) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found for this date'
      });
    }

    // Find the student's record within the attendance document using actual student _id
    const studentRecord = attendanceDoc.records.find(
      r => r.studentId.toString() === actualStudentId.toString()
    );

    if (!studentRecord) {
      console.log('❌ Student not found in attendance records. Looking for:', actualStudentId.toString());
      console.log('Available student IDs:', attendanceDoc.records.map(r => r.studentId.toString()));
      return res.status(404).json({
        success: false,
        message: 'Student not found in attendance record'
      });
    }

    // Check if student was actually absent
    if (studentRecord.status !== 'absent') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit reason for absent days'
      });
    }

    // Update the student's record with reason
    studentRecord.reason = reason;
    studentRecord.reviewStatus = 'Pending';
    studentRecord.reasonSubmittedAt = new Date();

    // Save the updated attendance document
    await attendanceDoc.save();

    console.log('✅ Absence reason submitted successfully');

    // Create notification for faculty (asynchronously, don't wait)
    (async () => {
      try {
        // Find faculty assigned to this class
        const assignments = await ClassAssignment.find({
          classId,
          status: 'active'
        });
        
        const facultyList = [];
        for (const assignment of assignments) {
          const faculty = await Faculty.findById(assignment.facultyId);
          if (faculty) {
            facultyList.push(faculty._id);
          }
        }

        // Get student info
        const Student = (await import('../models/Student.js')).default;
        const studentData = await Student.findById(actualStudentId).select('name rollNumber');

        // Create notifications
        const notificationMessage = `Student ${studentData?.name} (${studentData?.rollNumber}) submitted absence reason for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        const notifications = facultyList.map(facultyId => ({
          facultyId,
          message: notificationMessage,
          type: 'absence_reason',
          classRef: classId,
          metadata: {
            studentId: actualStudentId.toString(),
            studentName: studentData?.name,
            rollNumber: studentData?.rollNumber,
            date,
            reason
          },
          priority: 'high',
          actionUrl: `/faculty/class/${classId}`
        }));

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
          console.log(`✅ Created ${notifications.length} notifications for absence reason`);
        }
      } catch (error) {
        console.error('❌ Error creating absence reason notifications:', error);
      }
    })();

    res.json({
      success: true,
      message: 'Absence reason submitted successfully',
      data: {
        date,
        reason,
        reviewStatus: 'Pending',
        submittedAt: studentRecord.reasonSubmittedAt
      }
    });

  } catch (error) {
    console.error('❌ Submit reason error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit absence reason'
    });
  }
});

// @desc    Get pending reasons for review (Faculty)
// @route   GET /api/attendance/reasons/pending
// @access  Faculty and above
router.get('/reasons/pending', facultyAndAbove, async (req, res) => {
  try {
    const { department, classId, startDate, endDate } = req.query;
    const currentUser = req.user;

    // Build query
    const query = {
      department: department || currentUser.department,
      'records.reviewStatus': 'Pending'
    };

    if (classId) query.classId = classId;
    
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    console.log('📋 Fetching pending reasons with query:', query);
    console.log('📋 User department:', currentUser.department);
    console.log('📋 Requested classId:', classId);
    console.log('📋 Requested department:', department);

    const attendanceDocs = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(100);

    console.log(`📄 Found ${attendanceDocs.length} attendance documents matching query`);
    
    // Log all attendance docs to see their classIds
    attendanceDocs.forEach(doc => {
      console.log(`  - Date: ${doc.date}, ClassId: ${doc.classId}, Dept: ${doc.department}`);
      const pendingCount = doc.records.filter(r => r.reviewStatus === 'Pending').length;
      console.log(`    Pending records in this doc: ${pendingCount}`);
    });

    // Extract pending reasons from all documents
    const pendingReasons = [];
    attendanceDocs.forEach(doc => {
      doc.records.forEach(record => {
        if (record.reviewStatus === 'Pending' && record.status === 'absent') {
          console.log(`    ✓ Adding pending reason: ${record.name} (${record.rollNumber}) - ${record.reason}`);
          pendingReasons.push({
            classId: doc.classId,
            date: doc.date,
            department: doc.department,
            studentId: record.studentId,
            rollNumber: record.rollNumber,
            studentName: record.name,
            email: record.email,
            reason: record.reason,
            submittedAt: record.reasonSubmittedAt,
            reviewStatus: record.reviewStatus
          });
        }
      });
    });

    console.log(`✅ Found ${pendingReasons.length} pending reasons total`);

    res.json({
      success: true,
      data: {
        pendingReasons,
        total: pendingReasons.length
      }
    });

  } catch (error) {
    console.error('❌ Get pending reasons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reasons'
    });
  }
});

// @desc    Review/Approve absence reason (Faculty)
// @route   PUT /api/attendance/reason/review
// @access  Faculty and above
router.put('/reason/review', facultyAndAbove, [
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('facultyNote').optional().trim().isLength({ max: 500 }).withMessage('Faculty note cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { classId, date, studentId, facultyNote } = req.body;
    const currentUser = req.user;

    console.log('✅ Faculty reviewing absence reason:', { classId, date, studentId, facultyNote });

    // Find the attendance document
    const attendanceDoc = await Attendance.findOne({ classId, date });

    if (!attendanceDoc) {
      console.log('❌ Attendance document not found for:', { classId, date });
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    console.log('📄 Found attendance doc. Total records:', attendanceDoc.records.length);
    console.log('🔍 Looking for studentId:', studentId);
    console.log('📋 Available student IDs:', attendanceDoc.records.map(r => r.studentId.toString()).slice(0, 5));

    // Find the student's record
    const studentRecord = attendanceDoc.records.find(
      r => r.studentId.toString() === studentId.toString()
    );

    if (!studentRecord) {
      console.log('❌ Student record not found. Tried matching:', studentId);
      console.log('❌ Available IDs:', attendanceDoc.records.map(r => r.studentId.toString()));
      return res.status(404).json({
        success: false,
        message: 'Student not found in attendance record'
      });
    }

    console.log('✓ Found student record:', { name: studentRecord.name, rollNumber: studentRecord.rollNumber });

    // Update review status
    studentRecord.reviewStatus = 'Reviewed';
    studentRecord.reviewedBy = currentUser._id;
    studentRecord.reviewedAt = new Date();
    if (facultyNote) {
      studentRecord.facultyNote = facultyNote;
    }

    await attendanceDoc.save();

    console.log('✅ Absence reason reviewed successfully');

    res.json({
      success: true,
      message: 'Absence reason reviewed successfully',
      data: {
        date,
        reviewStatus: 'Reviewed',
        reviewedAt: studentRecord.reviewedAt,
        facultyNote: studentRecord.facultyNote
      }
    });

  } catch (error) {
    console.error('❌ Review reason error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review absence reason'
    });
  }
});

// @desc    Get student's submitted reasons
// @route   GET /api/attendance/reasons/student/:studentId
// @access  Student (own data) or Faculty
router.get('/reasons/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, semester } = req.query;
    const currentUser = req.user;

    // Authorization check
    const Student = (await import('../models/Student.js')).default;
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (currentUser.role === 'student' && currentUser._id.toString() !== student.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build query
    const query = {
      department: student.department,
      'records.studentId': studentId,
      'records.reason': { $ne: null }
    };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    console.log('📋 Fetching student reasons:', query);

    const attendanceDocs = await Attendance.find(query)
      .sort({ date: -1 });

    // Extract this student's reasons
    const studentReasons = [];
    attendanceDocs.forEach(doc => {
      const record = doc.records.find(r => r.studentId.toString() === studentId.toString());
      if (record && record.reason) {
        studentReasons.push({
          date: doc.date,
          status: record.status,
          reason: record.reason,
          reviewStatus: record.reviewStatus,
          facultyNote: record.facultyNote,
          submittedAt: record.reasonSubmittedAt,
          reviewedAt: record.reviewedAt
        });
      }
    });

    console.log(`✅ Found ${studentReasons.length} reasons for student`);

    res.json({
      success: true,
      data: {
        reasons: studentReasons,
        total: studentReasons.length
      }
    });

  } catch (error) {
    console.error('❌ Get student reasons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student reasons'
    });
  }
});

export default router;



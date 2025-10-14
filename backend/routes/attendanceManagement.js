/**
 * Attendance Management Routes
 * Handles all attendance operations for faculty
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { 
  markAttendance, 
  getAttendanceHistory, 
  getAttendanceDetails, 
  generateAttendanceReport,
  canEditAttendance 
} from '../services/attendanceService.js';
import ClassAttendance from '../models/ClassAttendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';

const router = express.Router();

// @desc    Mark attendance for a class
// @route   POST /api/attendance/mark
// @access  Faculty and above
router.post('/mark', authenticate, facultyAndAbove, [
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('absentStudents').isArray().withMessage('Absent students must be an array'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
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

    const { classId, date, absentStudents, notes } = req.body;
    const facultyId = req.user._id;

    // Validate that date is today
    const today = new Date();
    const attendanceDate = new Date(date);
    const todayStr = today.toISOString().split('T')[0];
    const attendanceDateStr = attendanceDate.toISOString().split('T')[0];

    if (attendanceDateStr !== todayStr) {
      return res.status(400).json({
        success: false,
        message: 'Attendance can only be marked for today'
      });
    }

    // Verify faculty authorization for this class
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Mark attendance
    const result = await markAttendance({
      facultyId: faculty._id,
      classId: classId,
      date: date,
      absentStudents: absentStudents,
      notes: notes
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.message,
        details: result.error.details
      });
    }

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get attendance history for a class
// @route   GET /api/attendance/history
// @access  Faculty and above
router.get('/history', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const facultyId = req.user._id;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    const result = await getAttendanceHistory({
      facultyId: faculty._id,
      classId: classId,
      startDate: startDate,
      endDate: endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.message
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error getting attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get attendance details for a specific date
// @route   GET /api/attendance/details
// @access  Faculty and above
router.get('/details', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, date } = req.query;
    const facultyId = req.user._id;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Class ID and date are required'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    const result = await getAttendanceDetails(faculty._id, classId, date);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error.message
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error getting attendance details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Edit attendance for a specific date
// @route   PUT /api/attendance/edit
// @access  Faculty and above
router.put('/edit', authenticate, facultyAndAbove, [
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('absentStudents').isArray().withMessage('Absent students must be an array'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
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

    const { classId, date, absentStudents, notes } = req.body;
    const facultyId = req.user._id;

    // Check if attendance can be edited (within 7 days)
    if (!canEditAttendance(date, 7)) {
      return res.status(400).json({
        success: false,
        message: 'Attendance can only be edited within 7 days'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Edit attendance (same as mark attendance but with edit validation)
    const result = await markAttendance({
      facultyId: faculty._id,
      classId: classId,
      date: date,
      absentStudents: absentStudents,
      notes: notes
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.message,
        details: result.error.details
      });
    }

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: result.data
    });

  } catch (error) {
    console.error('Error editing attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Generate attendance report
// @route   GET /api/attendance/report
// @access  Faculty and above
router.get('/report', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;
    const facultyId = req.user._id;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    const result = await generateAttendanceReport({
      facultyId: faculty._id,
      classId: classId,
      startDate: startDate,
      endDate: endDate
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error.message
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get students for attendance marking
// @route   GET /api/attendance/students
// @access  Faculty and above
router.get('/students', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId } = req.query;
    const facultyId = req.user._id;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Get students in the class
    const students = await Student.find({
      classId: classId,
      facultyId: faculty._id,
      status: 'active'
    }).select('rollNumber name email').sort({ rollNumber: 1 });

    res.json({
      success: true,
      data: {
        students: students,
        totalCount: students.length
      }
    });

  } catch (error) {
    console.error('Error getting students for attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Check if attendance exists for a date
// @route   GET /api/attendance/check
// @access  Faculty and above
router.get('/check', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, date } = req.query;
    const facultyId = req.user._id;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Class ID and date are required'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Check if attendance exists
    const attendance = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classId: classId,
      date: new Date(date)
    });

    res.json({
      success: true,
      data: {
        exists: !!attendance,
        canEdit: attendance ? canEditAttendance(date, 7) : false,
        attendance: attendance
      }
    });

  } catch (error) {
    console.error('Error checking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;

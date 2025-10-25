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

// Test endpoint to verify API is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance Management API is working',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance Management API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple test endpoint without authentication
router.get('/simple-test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple test endpoint working',
    timestamp: new Date().toISOString()
  });
});

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

    // Validate input data
    if (!classId || !absentStudents || !Array.isArray(absentStudents)) {
      return res.status(400).json({
        success: false,
        message: 'Class ID and absent students array are required'
      });
    }

    // Parse the incoming date and compare with today - use local date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];
    
    console.log('📅 Backend date comparison:', {
      now: now,
      today: today,
      todayStr: todayStr,
      incomingDate: date,
      isToday: date === todayStr
    });

    // Validate that date is today (direct string comparison)
    if (date !== todayStr) {
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

    // Get students in the class - parse classId to get class context
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId format'
      });
    }
    
    const [batch, year, semester, section] = parts;
    
    // Find students using the same method as frontend display
    const constructedClassId = `${batch}_${year}_${semester}_${section}`;
    
    // Query students that have the specific semester enrollment (same as getStudentsForFaculty)
    const query = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': constructedClassId,
      'semesters.status': 'active',
      status: 'active'
    };

    console.log('🔍 Students query:', JSON.stringify(query, null, 2));

    const students = await Student.find(query)
      .select('_id rollNumber name email batch year semester section department')
      .sort({ rollNumber: 1 });

    console.log(`📊 Retrieved ${students.length} students for class: ${constructedClassId}`);
    console.log('Students:', students.map(s => ({ id: s._id, rollNumber: s.rollNumber, name: s.name })));

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

// @desc    Check if attendance exists for a class and date
// @route   GET /api/attendance-management/check
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

    // Check if attendance exists using the same fields as the duplicate check
    const attendance = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classAssigned: classId,
      department: faculty.department,
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

// @desc    Get today's attendance for editing
// @route   GET /api/attendance-management/today
// @access  Faculty and above
router.get('/today', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId } = req.query;
    const facultyId = req.user._id;

    console.log('📋 GET /today - Request received');
    console.log('📋 Raw ClassId from query:', classId);
    console.log('📋 FacultyId:', facultyId);

    if (!classId) {
      console.log('❌ No classId provided');
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Decode URL-encoded classId
    const decodedClassId = decodeURIComponent(classId);
    console.log('📋 Decoded ClassId:', decodedClassId);

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    console.log('📋 Faculty found:', faculty ? 'Yes' : 'No');

    if (!faculty) {
      console.log('❌ Faculty not found or inactive');
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Get today's date in UTC
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    console.log('📋 Today\'s date:', todayISO);
    console.log('📋 Faculty department:', faculty.department);

    // Find today's attendance record - try multiple date formats
    let attendance = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classAssigned: decodedClassId,
      department: faculty.department,
      date: new Date(todayISO)
    });

    console.log('📋 First search result:', attendance ? 'Found' : 'Not found');

    // If not found, try with different date formats
    if (!attendance) {
      console.log('📋 Trying alternative date formats...');
      
      // Try with date range query
      const startOfDay = new Date(todayISO);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(todayISO);
      endOfDay.setUTCHours(23, 59, 59, 999);
      
      attendance = await ClassAttendance.findOne({
        facultyId: faculty._id,
        classAssigned: decodedClassId,
        department: faculty.department,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      console.log('📋 Attendance found with date range:', attendance ? 'Yes' : 'No');
    }

    // If still not found, try to find any attendance for this class/faculty
    if (!attendance) {
      console.log('📋 Trying to find any attendance for this class/faculty...');
      const anyAttendance = await ClassAttendance.findOne({
        facultyId: faculty._id,
        classAssigned: decodedClassId,
        department: faculty.department
      }).sort({ date: -1 });
      
      if (anyAttendance) {
        console.log('📋 Found attendance for different date:', anyAttendance.date);
        console.log('📋 Requested date:', todayISO);
        console.log('📋 Any attendance classAssigned:', anyAttendance.classAssigned);
        console.log('📋 Any attendance classId:', anyAttendance.classId);
      } else {
        // Try with original classId as fallback
        console.log('📋 Trying with original classId as fallback...');
        const fallbackAttendance = await ClassAttendance.findOne({
          facultyId: faculty._id,
          classAssigned: classId,
          department: faculty.department
        }).sort({ date: -1 });
        
        if (fallbackAttendance) {
          console.log('📋 Found attendance with original classId:', fallbackAttendance.classAssigned);
          attendance = fallbackAttendance;
        }
      }
    }

    console.log('📋 Attendance found:', attendance ? 'Yes' : 'No');
    if (attendance) {
      console.log('📋 Attendance details:', {
        id: attendance._id,
        presentStudents: attendance.presentStudents,
        absentStudents: attendance.absentStudents,
        totalStudents: attendance.totalStudents
      });
    } else {
      // Final debugging - show all attendance records for this faculty
      console.log('📋 Final debugging - checking all attendance records for this faculty...');
      const allAttendance = await ClassAttendance.find({
        facultyId: faculty._id,
        department: faculty.department
      }).select('classAssigned classId date').sort({ date: -1 }).limit(5);
      
      console.log('📋 All attendance records for faculty:', allAttendance.map(a => ({
        classAssigned: a.classAssigned,
        classId: a.classId,
        date: a.date
      })));
      
      console.log('📋 Searching for classId:', decodedClassId);
      console.log('📋 Searching for original classId:', classId);
    }

    if (!attendance) {
      console.log('❌ No attendance record found for today');
      return res.status(404).json({
        success: false,
        message: 'No attendance record found for today'
      });
    }

    // Get all students in the class for reference
    const parts = decodedClassId.split('_');
    console.log('📋 Decoded ClassId parts:', parts);
    
    if (parts.length !== 4) {
      console.log('❌ Invalid classId format');
      return res.status(400).json({
        success: false,
        message: 'Invalid classId format'
      });
    }
    const [batch, year, semester, section] = parts;

    console.log('📋 Parsed class details:', { batch, year, semester, section });

    // Use the same query logic as the faculty students endpoint
    const query = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': decodedClassId,
      'semesters.status': 'active',
      status: 'active'
    };

    console.log('📋 Students query for today endpoint:', JSON.stringify(query, null, 2));

    const students = await Student.find(query)
      .select('_id rollNumber name email')
      .sort({ rollNumber: 1 });

    console.log('📋 Students found:', students.length);

    const responseData = {
      success: true,
      data: {
        attendance: {
          _id: attendance._id,
          date: attendance.date,
          presentStudents: attendance.presentStudents || [],
          absentStudents: attendance.absentStudents || [],
          totalStudents: attendance.totalStudents,
          totalPresent: attendance.totalPresent,
          totalAbsent: attendance.totalAbsent,
          status: attendance.status,
          updatedAt: attendance.updatedAt
        },
        students: students,
        canEdit: canEditAttendance(todayISO, 7) // Can edit within 7 days
      }
    };

    console.log('📋 Sending response:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching today\'s attendance:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @desc    Update today's attendance
// @route   PUT /api/attendance-management/update-today
// @access  Faculty and above
router.put('/update-today', authenticate, facultyAndAbove, [
  body('classId').notEmpty().withMessage('Class ID is required'),
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

    const { classId, absentStudents, notes } = req.body;
    const facultyId = req.user._id;

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

    // Get today's date in UTC
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // Find today's attendance record
    const attendance = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classAssigned: classId,
      department: faculty.department,
      date: new Date(todayISO)
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No attendance record found for today'
      });
    }

    // Get all students in the class
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId format'
      });
    }
    const [batch, year, semester, section] = parts;

    // Use the same query logic as the faculty students endpoint
    const query = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': classId,
      'semesters.status': 'active',
      status: 'active'
    };

    const students = await Student.find(query)
      .select('_id rollNumber name email');

    // Validate absent students
    const allRollNumbers = students.map(s => s.rollNumber);
    const invalidRollNumbers = absentStudents.filter(roll => !allRollNumbers.includes(roll));
    
    if (invalidRollNumbers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roll numbers not found in class: ${invalidRollNumbers.join(', ')}`
      });
    }

    // Calculate present students
    const presentStudents = students
      .filter(student => !absentStudents.includes(student.rollNumber))
      .map(student => student.rollNumber);

    // Update attendance record
    attendance.absentStudents = absentStudents;
    attendance.presentStudents = presentStudents;
    attendance.totalPresent = presentStudents.length;
    attendance.totalAbsent = absentStudents.length;
    attendance.status = 'modified';
    attendance.updatedBy = facultyId;
    attendance.notes = notes || attendance.notes;

    await attendance.save();

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: {
        attendance: {
          _id: attendance._id,
          date: attendance.date,
          presentStudents: attendance.presentStudents,
          absentStudents: attendance.absentStudents,
          totalStudents: attendance.totalStudents,
          totalPresent: attendance.totalPresent,
          totalAbsent: attendance.totalAbsent,
          status: attendance.status,
          updatedAt: attendance.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating today\'s attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;

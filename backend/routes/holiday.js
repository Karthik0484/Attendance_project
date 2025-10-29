import express from 'express';
import { body, validationResult } from 'express-validator';
import Holiday from '../models/Holiday.js';
import ClassAttendance from '../models/ClassAttendance.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { normalizeDateToString, isValidDateString } from '../utils/dateUtils.js';

const router = express.Router();

// All holiday routes require authentication
router.use(authenticate);

// @desc    Declare a holiday for a specific class
// @route   POST /api/holidays/declare
// @access  Faculty and above
router.post('/declare', facultyAndAbove, [
  body('date').notEmpty().withMessage('Date is required'),
  body('reason').trim().isLength({ min: 1, max: 255 }).withMessage('Reason is required and must be between 1-255 characters'),
  body('batchYear').optional().isString().withMessage('Batch year must be a string'),
  body('section').optional().isString().withMessage('Section must be a string'),
  body('semester').optional().isString().withMessage('Semester must be a string'),
  body('scope').optional().isIn(['class', 'global']).withMessage('Scope must be either "class" or "global"')
], async (req, res) => {
  try {
    console.log('🎉 Holiday declaration request:', {
      body: req.body,
      user: req.user?.name,
      department: req.user?.department,
      userId: req.user?._id
    });

    // Check if user has required data
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }

    // Set default department if not present
    if (!req.user.department) {
      req.user.department = 'CSE'; // Default department
      console.log('⚠️ User department not found, using default: CSE');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      console.log('❌ Request body:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { date, reason, batchYear, section, semester, scope = 'class' } = req.body;
    const currentUser = req.user;

    // Validate and normalize date to YYYY-MM-DD format
    let holidayDateString;
    try {
      // Handle both string and Date object inputs
      if (typeof date === 'string') {
        // If it's already in YYYY-MM-DD format, use it directly
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          holidayDateString = date;
        } else {
          // Otherwise, parse it and convert to YYYY-MM-DD
          const dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date');
          }
          holidayDateString = dateObj.toISOString().split('T')[0];
        }
      } else {
        holidayDateString = normalizeDateToString(date);
      }
    } catch (error) {
      console.log('❌ Date validation error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    // For class scope, validate required fields
    if (scope === 'class') {
      if (!batchYear || !section || !semester) {
        return res.status(400).json({
          status: 'error',
          message: 'Batch year, section, and semester are required for class scope holidays'
        });
      }
    }

    // Check if attendance already exists for this date and class
    if (scope === 'class') {
      const existingAttendance = await ClassAttendance.findOne({
        classId: `${batchYear}_${currentUser.department}_${semester}_${section}`,
        date: holidayDateString,
        isDeleted: false
      });

      if (existingAttendance) {
        return res.status(400).json({
          status: 'error',
          message: 'Attendance already marked for this date. Cannot declare holiday.'
        });
      }
    }

    // Check if holiday already exists for this date and scope
    const existingHolidayQuery = {
      date: holidayDateString,
      department: currentUser.department,
      isActive: true,
      isDeleted: false
    };

    if (scope === 'class') {
      existingHolidayQuery.batchYear = batchYear;
      existingHolidayQuery.section = section;
      existingHolidayQuery.semester = semester;
    } else {
      existingHolidayQuery.scope = 'global';
    }

    const existingHoliday = await Holiday.findOne(existingHolidayQuery);

    if (existingHoliday) {
      return res.status(400).json({
        status: 'error',
        message: 'Holiday already declared for this date'
      });
    }

    // Create new holiday
    const holidayData = {
      date: holidayDateString,
      reason,
      declaredBy: currentUser._id,
      scope,
      department: currentUser.department,
      isActive: true
    };

    if (scope === 'class') {
      holidayData.batchYear = batchYear;
      holidayData.section = section;
      holidayData.semester = semester;
    }

    const holiday = new Holiday(holidayData);

    try {
      await holiday.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        return res.status(400).json({
          status: 'error',
          message: 'Holiday already declared for this date'
        });
      }
      throw saveError;
    }

    console.log('🎉 Holiday declared:', {
      holidayId: holiday.holidayId,
      date: holidayDateString,
      reason,
      scope,
      batchYear: scope === 'class' ? batchYear : 'N/A',
      section: scope === 'class' ? section : 'N/A',
      semester: scope === 'class' ? semester : 'N/A',
      department: currentUser.department,
      declaredBy: currentUser.name
    });

    res.status(201).json({
      status: 'success',
      message: 'Holiday declared successfully',
      data: {
        holidayId: holiday.holidayId,
        date: holiday.date,
        reason: holiday.reason,
        scope: holiday.scope,
        batchYear: holiday.batchYear,
        section: holiday.section,
        semester: holiday.semester,
        department: holiday.department,
        declaredBy: currentUser.name,
        createdAt: holiday.createdAt
      }
    });

  } catch (error) {
    console.error('Declare holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to declare holiday'
    });
  }
});

// @desc    Get holidays for a specific class or global holidays
// @route   GET /api/holidays
// @access  Faculty and above
router.get('/', facultyAndAbove, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      year, 
      batchYear, 
      section, 
      semester, 
      scope = 'class' 
    } = req.query;
    const currentUser = req.user;

    let dateFilter = {};

    if (startDate && endDate) {
      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      dateFilter = { $gte: start, $lte: end };
    } else if (year) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    } else {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    }

    const query = {
      department: currentUser.department,
      isActive: true,
      isDeleted: false,
      date: dateFilter
    };

    if (scope === 'class') {
      if (batchYear) query.batchYear = batchYear;
      if (section) query.section = section;
      if (semester) query.semester = semester;
    } else {
      query.scope = 'global';
    }

    const holidays = await Holiday.find(query)
      .populate('declaredBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ date: 1 });

    console.log('📅 Fetching holidays:', {
      department: currentUser.department,
      scope,
      query,
      foundHolidays: holidays.length
    });

    res.json({
      status: 'success',
      data: holidays.map(holiday => ({
        holidayId: holiday.holidayId,
        date: holiday.date,
        reason: holiday.reason,
        scope: holiday.scope,
        batchYear: holiday.batchYear,
        section: holiday.section,
        semester: holiday.semester,
        department: holiday.department,
        declaredBy: holiday.declaredBy.name,
        updatedBy: holiday.updatedBy?.name || null,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt
      }))
    });

  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch holidays'
    });
  }
});

// @desc    Check if a specific date is a holiday for a class
// @route   GET /api/holidays/check/:date
// @access  Faculty and above
router.get('/check/:date', facultyAndAbove, async (req, res) => {
  try {
    const { date } = req.params;
    const { batchYear, section, semester } = req.query;
    const currentUser = req.user;

    const checkDate = new Date(date);
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format'
      });
    }
    
    const checkDateString = checkDate.toISOString().split('T')[0];

    // Check for both class-specific and global holidays
    const holidayQuery = {
      date: checkDateString,
      department: currentUser.department,
      isActive: true,
      isDeleted: false,
      $or: [
        { scope: 'global' }
      ]
    };

    // Add class-specific holiday check if class parameters are provided
    if (batchYear && section && semester) {
      holidayQuery.$or.push({
        scope: 'class',
        batchYear,
        section,
        semester
      });
    }

    const holiday = await Holiday.findOne(holidayQuery)
      .populate('declaredBy', 'name');

    res.json({
      status: 'success',
      data: {
        isHoliday: !!holiday,
        holiday: holiday ? {
          holidayId: holiday.holidayId,
          date: holiday.date,
          reason: holiday.reason,
          scope: holiday.scope,
          batchYear: holiday.batchYear,
          section: holiday.section,
          semester: holiday.semester,
          declaredBy: holiday.declaredBy.name
        } : null
      }
    });

  } catch (error) {
    console.error('Check holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check holiday status'
    });
  }
});

// @desc    Update an existing holiday
// @route   PUT /api/holidays/:holidayId
// @access  Faculty and above
router.put('/:holidayId', facultyAndAbove, [
  body('reason').trim().isLength({ min: 1, max: 255 }).withMessage('Reason is required and must be between 1-255 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { holidayId } = req.params;
    const { reason } = req.body;
    const currentUser = req.user;

    const holiday = await Holiday.findOne({
      holidayId,
      department: currentUser.department,
      isActive: true,
      isDeleted: false
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Update the holiday reason
    holiday.reason = reason;
    holiday.updatedBy = currentUser._id;

    await holiday.save();

    console.log('✏️ Holiday updated:', {
      holidayId: holiday.holidayId,
      date: holiday.date,
      reason,
      department: currentUser.department,
      updatedBy: currentUser.name
    });

    res.json({
      status: 'success',
      message: 'Holiday updated successfully',
      data: {
        holidayId: holiday.holidayId,
        date: holiday.date,
        reason: holiday.reason,
        scope: holiday.scope,
        batchYear: holiday.batchYear,
        section: holiday.section,
        semester: holiday.semester,
        department: holiday.department,
        declaredBy: holiday.declaredBy,
        updatedBy: currentUser.name,
        updatedAt: holiday.updatedAt
      }
    });

  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update holiday'
    });
  }
});

// @desc    Delete (deactivate) a holiday
// @route   DELETE /api/holidays/:holidayId
// @access  Faculty and above
router.delete('/:holidayId', facultyAndAbove, async (req, res) => {
  try {
    const { holidayId } = req.params;
    const currentUser = req.user;

    const holiday = await Holiday.findOne({
      holidayId,
      department: currentUser.department,
      isActive: true,
      isDeleted: false
    });

    if (!holiday) {
      return res.status(404).json({
        status: 'error',
        message: 'Holiday not found'
      });
    }

    // Soft delete by setting isActive to false
    holiday.isActive = false;
    holiday.updatedBy = currentUser._id;
    await holiday.save();

    console.log('🗑️ Holiday deactivated:', {
      holidayId: holiday.holidayId,
      date: holiday.date,
      reason: holiday.reason,
      deactivatedBy: currentUser.name
    });

    res.json({
      status: 'success',
      message: 'Holiday deactivated successfully'
    });

  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to deactivate holiday'
    });
  }
});

// @desc    Get holidays for analytics calculation
// @route   GET /api/holidays/analytics
// @access  Faculty and above
router.get('/analytics', facultyAndAbove, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      batchYear, 
      section, 
      semester 
    } = req.query;
    const currentUser = req.user;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate).toISOString().split('T')[0];
    const end = new Date(endDate).toISOString().split('T')[0];

    const query = {
      department: currentUser.department,
      isActive: true,
      isDeleted: false,
      date: { $gte: start, $lte: end },
      $or: [
        { scope: 'global' }
      ]
    };

    // Add class-specific holidays if parameters provided
    if (batchYear && section && semester) {
      query.$or.push({
        scope: 'class',
        batchYear,
        section,
        semester
      });
    }

    const holidays = await Holiday.find(query)
      .select('date reason scope')
      .sort({ date: 1 });

    console.log('📊 Analytics holidays:', {
      department: currentUser.department,
      dateRange: { start, end },
      batchYear,
      section,
      semester,
      foundHolidays: holidays.length
    });

    res.json({
      status: 'success',
      data: {
        holidays: holidays.map(h => ({
          date: h.date,
          reason: h.reason,
          scope: h.scope
        })),
        count: holidays.length
      }
    });

  } catch (error) {
    console.error('Get analytics holidays error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch holidays for analytics'
    });
  }
});

// @desc    Get holidays for students (accessible to all authenticated users)
// @route   GET /api/holidays/student
// @access  Student and above
router.get('/student', async (req, res) => {
  try {
    const currentUser = req.user;

    // Get student details from the user
    const Student = (await import('../models/Student.js')).default;
    const student = await Student.findOne({ 
      userId: currentUser._id,
      status: 'active'
    });

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student record not found'
      });
    }

    // Get current date range (e.g., current academic year)
    const { startDate, endDate, limit = 50 } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      dateFilter = { $gte: start, $lte: end };
    } else {
      // Default to current year
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      dateFilter = { $gte: yearStart, $lte: yearEnd };
    }

    // Build OR conditions for all student's semesters (new schema) and legacy fields
    const orConditions = [
      { scope: 'global' } // Always include global holidays
    ];

    // Add class-specific holidays for each enrolled semester
    if (student.semesters && student.semesters.length > 0) {
      student.semesters.forEach(sem => {
        orConditions.push({
          scope: 'class',
          batchYear: sem.batch,
          section: sem.section,
          semester: sem.semesterName
        });
      });
    }
    
    // Fallback: if no semesters array, use legacy fields
    if (orConditions.length === 1 && student.batchYear && student.section && student.semester) {
      orConditions.push({
        scope: 'class',
        batchYear: student.batchYear,
        section: student.section,
        semester: student.semester
      });
    }

    // Query for both global and class-specific holidays
    const query = {
      department: student.department,
      isActive: true,
      isDeleted: false,
      date: dateFilter,
      $or: orConditions
    };

    const holidays = await Holiday.find(query)
      .populate('declaredBy', 'name')
      .select('date reason scope batchYear section semester declaredBy createdAt')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log('🎓 Student holidays fetched:', {
      studentId: student._id,
      studentName: student.name,
      department: student.department,
      semestersCount: student.semesters?.length || 0,
      semesters: student.semesters?.map(s => ({
        batch: s.batch,
        section: s.section,
        semester: s.semesterName
      })) || [],
      legacyFields: {
        batchYear: student.batchYear,
        section: student.section,
        semester: student.semester
      },
      foundHolidays: holidays.length,
      queryConditions: orConditions.length
    });

    res.json({
      status: 'success',
      data: {
        holidays: holidays.map(holiday => ({
          date: holiday.date,
          reason: holiday.reason,
          scope: holiday.scope,
          batchYear: holiday.batchYear,
          section: holiday.section,
          semester: holiday.semester,
          declaredBy: holiday.declaredBy?.name || 'Faculty',
          createdAt: holiday.createdAt
        })),
        count: holidays.length,
        studentInfo: {
          department: student.department,
          semestersCount: student.semesters?.length || 0,
          semesters: student.semesters?.map(s => ({
            batch: s.batch,
            section: s.section,
            semester: s.semesterName
          })) || []
        }
      }
    });

  } catch (error) {
    console.error('Get student holidays error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch holidays'
    });
  }
});

export default router;
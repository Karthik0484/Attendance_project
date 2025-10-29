import express from 'express';
import { body, validationResult } from 'express-validator';
import Semester from '../models/Semester.js';
import { authenticate, facultyAndAbove, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @desc    Create a new semester
// @route   POST /api/semesters
// @access  Admin only
router.post('/', adminOnly, [
  body('semesterNumber').isInt({ min: 1, max: 8 }).withMessage('Semester number must be between 1 and 8'),
  body('batchYear').matches(/^\d{4}-\d{4}$/).withMessage('Batch year must be in format YYYY-YYYY'),
  body('department').isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Invalid department'),
  body('section').isIn(['A', 'B']).withMessage('Section must be A or B'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('academicYear').notEmpty().withMessage('Academic year is required')
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

    const { semesterNumber, batchYear, department, section, startDate, endDate, academicYear, isActive = true } = req.body;

    // Check if semester already exists
    const existingSemester = await Semester.findOne({
      semesterNumber,
      batchYear,
      department,
      section
    });

    if (existingSemester) {
      return res.status(400).json({
        success: false,
        message: 'Semester already exists for this batch, department, and section'
      });
    }

    const semester = new Semester({
      semesterNumber,
      batchYear,
      department,
      section,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      academicYear,
      isActive,
      createdBy: req.user._id
    });

    await semester.save();

    console.log('✅ Semester created:', semester.displayName);

    res.status(201).json({
      success: true,
      message: 'Semester created successfully',
      data: semester
    });

  } catch (error) {
    console.error('Create semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create semester'
    });
  }
});

// @desc    Get all semesters for a student
// @route   GET /api/semesters/student/:studentId
// @access  Faculty and above, or student accessing their own data
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const Student = (await import('../models/Student.js')).default;

    // Get student to find their batch and department
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Authorization check
    if (req.user.role === 'student' && req.user._id.toString() !== student.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all semesters for this student's batch, department, and section
    const semesters = await Semester.find({
      batchYear: student.batchYear,
      department: student.department,
      section: student.section
    }).sort({ semesterNumber: 1 });

    // Find the current/active semester
    const now = new Date();
    const currentSemester = semesters.find(sem => 
      sem.isActive && new Date(sem.startDate) <= now && new Date(sem.endDate) >= now
    ) || semesters[semesters.length - 1]; // Fallback to latest if none active

    res.json({
      success: true,
      data: {
        semesters,
        currentSemester,
        totalSemesters: semesters.length
      }
    });

  } catch (error) {
    console.error('Get student semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters'
    });
  }
});

// @desc    Get semester by ID
// @route   GET /api/semesters/:id
// @access  Faculty and above
router.get('/:id', facultyAndAbove, async (req, res) => {
  try {
    const semester = await Semester.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }

    res.json({
      success: true,
      data: semester
    });

  } catch (error) {
    console.error('Get semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semester'
    });
  }
});

// @desc    Update semester
// @route   PUT /api/semesters/:id
// @access  Admin only
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { startDate, endDate, isActive, totalWorkingDays } = req.body;

    const semester = await Semester.findById(req.params.id);
    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }

    if (startDate) semester.startDate = new Date(startDate);
    if (endDate) semester.endDate = new Date(endDate);
    if (typeof isActive !== 'undefined') semester.isActive = isActive;
    if (totalWorkingDays) semester.totalWorkingDays = totalWorkingDays;

    await semester.save();

    res.json({
      success: true,
      message: 'Semester updated successfully',
      data: semester
    });

  } catch (error) {
    console.error('Update semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update semester'
    });
  }
});

// @desc    Get all semesters with filters
// @route   GET /api/semesters
// @access  Faculty and above
router.get('/', facultyAndAbove, async (req, res) => {
  try {
    const { batchYear, department, section, isActive } = req.query;

    const query = {};
    if (batchYear) query.batchYear = batchYear;
    if (department) query.department = department;
    if (section) query.section = section;
    if (typeof isActive !== 'undefined') query.isActive = isActive === 'true';

    const semesters = await Semester.find(query)
      .sort({ batchYear: -1, semesterNumber: 1 })
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      data: {
        semesters,
        total: semesters.length
      }
    });

  } catch (error) {
    console.error('Get semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semesters'
    });
  }
});

export default router;



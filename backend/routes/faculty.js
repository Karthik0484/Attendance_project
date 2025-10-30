import express from 'express';
import { body, validationResult } from 'express-validator';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import ClassAssignment from '../models/ClassAssignment.js';
import Student from '../models/Student.js';
import { authenticate, hodAndAbove, facultyAndAbove } from '../middleware/auth.js';
import { createStudentWithStandardizedData } from '../services/studentCreationService.js';
import { getStudentsForSemester } from '../services/multiSemesterStudentService.js';
import { createOrUpdateStudent, getStudentsForFaculty } from '../services/unifiedStudentService.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Profile route for individual faculty (less restrictive)
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Faculty can view their own profile, or admins/HODs can view any profile
    if (req.user.role !== 'admin' && req.user.role !== 'hod' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        msg: 'Access denied. You can only view your own profile.'
      });
    }

    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId }).populate('userId', 'name email department role');
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        msg: 'Faculty profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: faculty._id,
        name: faculty.name,
        email: faculty.email,
        position: faculty.position,
        assignedClass: faculty.assignedClass,
        department: faculty.department,
        phone: faculty.phone,
        is_class_advisor: faculty.is_class_advisor,
        batch: faculty.batch,
        year: faculty.year,
        semester: faculty.semester,
        status: faculty.status,
        advisorAssignment: faculty.getAdvisorAssignment()
      }
    });
  } catch (error) {
    console.error('Error fetching faculty profile:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error'
    });
  }
});

// All other faculty routes require authentication and HOD or above role
router.use(authenticate);
// Note: Individual routes will specify their own authorization requirements

// @desc    Test HOD authentication
// @route   GET /api/faculty/test-auth
// @access  HOD and above
router.get('/test-auth', hodAndAbove, (req, res) => {
  res.json({
    status: 'success',
    message: 'HOD authentication working',
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department
    }
  });
});

// Generate batch ranges for the dropdown (2020-2030 with +4 years)
const generateBatchRanges = () => {
  const startYear = 2020;
  const endYear = 2030;
  const batches = [];
  
  for (let year = startYear; year <= endYear; year++) {
    const batchRange = `${year}-${year + 4}`;
    batches.push(batchRange);
  }
  
  return batches.reverse(); // Show newest first
};

// @desc    Get available batch ranges for HOD
// @route   GET /api/faculty/batch-ranges
// @access  Faculty and above
router.get('/batch-ranges', facultyAndAbove, (req, res) => {
  try {
    const batches = generateBatchRanges();
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error generating batch ranges:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to generate batch ranges'
    });
  }
});

// @desc    Check if class advisor position is available for HOD
// @route   POST /api/faculty/check-advisor-availability
// @access  HOD and above
router.post('/check-advisor-availability', hodAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section, department } = req.body;

    if (!batch || !year || !semester || !section || !department) {
      return res.status(400).json({
        success: false,
        msg: 'Batch, year, semester, section, and department are required'
      });
    }

    // HOD can only check availability for their own department
    if (req.user.role === 'hod' && req.user.department !== department) {
      return res.status(403).json({
        success: false,
        msg: 'HOD can only check advisor availability for their own department'
      });
    }

    // Validate batch format
    if (!batch.match(/^\d{4}-\d{4}$/)) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid batch format. Expected format: YYYY-YYYY (e.g., 2022-2026)'
      });
    }

    // Check if another faculty is already assigned to this batch/year/semester/section in this department
    const existingAdvisor = await Faculty.findOne({
      is_class_advisor: true,
      batch,
      year,
      semester,
      section, // ✅ Include section in uniqueness check
      department,
      status: 'active'
    });

    let available = true;
    let existingAdvisorInfo = null;

    if (existingAdvisor) {
      available = false;
      existingAdvisorInfo = {
        name: existingAdvisor.name,
        email: existingAdvisor.email
      };
    }

    res.json({
      success: true,
      data: {
        available,
        classId: `${year}-${semester}-${batch}`,
        existingAdvisor: existingAdvisorInfo
      }
    });
  } catch (error) {
    console.error('Error checking advisor availability:', error);
    res.status(500).json({
      success: false,
      msg: 'Failed to check advisor availability'
    });
  }
});

// @desc    Create new faculty
// @route   POST /api/faculty/create
// @access  HOD and above
router.post('/create', hodAndAbove, [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('position').isIn(['Assistant Professor', 'Associate Professor', 'Professor']).withMessage('Invalid position'),
  body('assignedClass').optional().trim(),
  // Class advisor fields
  body('is_class_advisor').optional().isBoolean().withMessage('is_class_advisor must be boolean'),
  body('batch').optional().matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').optional().isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid year'),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1-8'),
  body('section').optional().isIn(['A', 'B', 'C']).withMessage('Section must be one of: A, B, C')
], async (req, res) => {
  try {
    console.log('🔍 Faculty creation request received');
    console.log('User:', req.user ? { id: req.user._id, role: req.user.role, department: req.user.department } : 'No user');
    console.log('Request body:', req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      name, 
      email, 
      password, 
      position, 
      assignedClass,
      is_class_advisor,
      batch,
      year,
      semester,
      section
    } = req.body;
    const currentUser = req.user;

    // Validate year-semester combination for class advisors
    if (is_class_advisor && year && semester) {
      const validSemesters = {
        "1st Year": [1, 2],
        "2nd Year": [3, 4],
        "3rd Year": [5, 6],
        "4th Year": [7, 8]
      };
      
      if (!validSemesters[year] || !validSemesters[year].includes(parseInt(semester))) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid year-semester combination. Please select valid semester for the chosen year.'
        });
      }
    }

    console.log('🔍 Faculty creation data received:', {
      is_class_advisor,
      batch,
      year,
      semester,
      section,
      batchType: typeof batch,
      yearType: typeof year,
      semesterType: typeof semester,
      sectionType: typeof section
    });

    // Class advisor validations
    if (is_class_advisor) {
      if (!batch || !year || !semester || !section) {
        console.log('❌ Missing required fields:', {
          batch: !!batch,
          year: !!year,
          semester: !!semester,
          section: !!section
        });
        return res.status(400).json({
          status: 'error',
          message: 'Batch, year, semester, and section are required for class advisors'
        });
      }

      // Validate batch format
      if (!batch.match(/^\d{4}-\d{4}$/)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid batch format. Expected format: YYYY-YYYY (e.g., 2022-2026)'
        });
      }

      // Check if another faculty is already assigned to this batch/year/semester/section
      const existingAdvisor = await Faculty.findOne({
        is_class_advisor: true,
        batch,
        year,
        semester,
        section, // ✅ Include section in uniqueness check
        department: currentUser.department, // Use HOD's department
        status: 'active'
      });

      if (existingAdvisor) {
        return res.status(400).json({
          status: 'error',
          message: `Another faculty is already assigned as class advisor for Batch ${batch}, ${year}, Semester ${semester}, Section ${section}`,
          existingAdvisor: {
            name: existingAdvisor.name,
            email: existingAdvisor.email
          }
        });
      }
    }

    // Check if faculty already exists (by user email across system)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Faculty already exists'
      });
    }

    // Create corresponding user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'faculty',
      department: currentUser.department,
      assignedClasses: assignedClass && assignedClass !== 'None' ? [assignedClass] : [],
      createdBy: currentUser._id
    });
    await user.save();

    // Generate assignedClass string for class advisors
    let finalAssignedClass = assignedClass || 'None';
    if (is_class_advisor && batch && year && semester && section) {
      finalAssignedClass = `${batch}, ${year}, Sem ${semester}, Section ${section}`;
    }

    // Create faculty details and link to userId
    const faculty = new Faculty({
      userId: user._id,
      name,
      email: email.toLowerCase(),
      position,
      assignedClass: finalAssignedClass,
      department: currentUser.department,
      createdBy: currentUser._id,
      is_class_advisor: is_class_advisor || false,
      batch: is_class_advisor ? batch : undefined,
      year: is_class_advisor ? year : undefined,
      semester: is_class_advisor ? semester : undefined,
      section: is_class_advisor ? section : undefined,
      // Initialize assignedClasses array
      assignedClasses: []
    });
    await faculty.save();

    // If faculty is assigned as class advisor, add to assignedClasses array
    if (is_class_advisor && batch && year && semester && section) {
      console.log('Adding class assignment to faculty during creation:', {
        batch,
        year,
        semester,
        section,
        assignedBy: currentUser._id
      });
      
      faculty.assignedClasses.push({
        batch,
        year,
        semester,
        section,
        assignedDate: new Date(),
        assignedBy: currentUser._id,
        active: true
      });
      await faculty.save();
      console.log('Faculty assignedClasses updated:', faculty.assignedClasses);

      // Also create a ClassAssignment record
      try {
        const classAssignment = await ClassAssignment.assignAdvisor({
          facultyId: user._id,
          batch,
          year,
          semester,
          section,
          departmentId: currentUser._id,
          assignedBy: currentUser._id,
          notes: `Assigned during faculty creation by HOD ${currentUser.name}`
        });
        console.log('ClassAssignment record created during faculty creation:', classAssignment._id);
      } catch (classAssignmentError) {
        console.error('Error creating ClassAssignment record during faculty creation:', classAssignmentError);
        // Don't fail the faculty creation, just log the error
      }
    }

    const facultyResponse = faculty.toObject();

    let advisorMessage = '';
    if (is_class_advisor) {
      advisorMessage = ` and assigned as Class Advisor for Batch ${batch}, ${year}, Semester ${semester}, Section ${section}`;
    }

    res.status(201).json({
      status: 'success',
      message: `Faculty created successfully${advisorMessage}`,
      data: {
        ...facultyResponse,
        advisorAssignment: faculty.getAdvisorAssignment()
      }
    });
  } catch (error) {
    console.error('Create faculty error:', error);
    // Best-effort rollback if user created but faculty failed
    if (error?.keyPattern?.email || error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Faculty already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get all faculties in HOD's department
// @route   GET /api/faculty/list
// @access  HOD and above
router.get('/list', hodAndAbove, async (req, res) => {
  try {
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    // Build filter object
    const filter = {};
    
    // HODs can only see faculty in their department, Admins can see all
    if (currentUser.role === 'hod') {
      filter.department = currentUser.department;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const faculties = await Faculty.find(filter)
      .select('-password')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() to avoid schema validation issues

    const total = await Faculty.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        faculties,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Get faculties error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get faculty assigned classes
// @route   GET /api/faculty/:facultyId/classes
// @access  Faculty and above
router.get('/:facultyId/classes', facultyAndAbove, async (req, res) => {
  try {
    const { facultyId } = req.params;
    const currentUser = req.user;

    // Verify the faculty is accessing their own classes or is HOD/admin
    if (currentUser._id.toString() !== facultyId && !['hod', 'admin', 'principal'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own assigned classes'
      });
    }

    console.log('🔍 Fetching assigned classes for faculty:', facultyId);

    // Get ALL assigned classes from ClassAssignment model (both active and inactive)
    const classAssignments = await ClassAssignment.find({
      facultyId: facultyId
    })
    .populate('facultyId', 'name email')
    .sort({ assignedDate: -1 }); // Most recent first

    console.log('📋 Found class assignments:', classAssignments.length, classAssignments);

    // Format assigned classes with status information
    const assignedClasses = classAssignments.map(assignment => {
      // Determine if class is active (handle both old and new schema)
      const isActive = assignment.status === 'Active' || 
                      (!assignment.status && assignment.active === true);
      
      return {
        classId: assignment._id,
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section,
        department: assignment.departmentId,
        assignedDate: assignment.assignedDate,
        notes: assignment.notes,
        status: isActive ? 'Active' : 'Inactive',
        isActive: isActive,
        deactivatedDate: assignment.deactivatedDate,
        role: assignment.role || 'Class Advisor'
      };
    });

    console.log('✅ Formatted assigned classes:', assignedClasses);

    res.json({
      success: true,
      data: assignedClasses,
      message: 'Assigned classes retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching faculty assigned classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assigned classes'
    });
  }
});

// @desc    Get faculty dashboard data
// @route   GET /api/faculty/:facultyId/dashboard
// @access  Faculty and above
router.get('/:facultyId/dashboard', facultyAndAbove, async (req, res) => {
  try {
    const { facultyId } = req.params;
    const currentUser = req.user;

    // Verify the faculty is accessing their own dashboard or is HOD/admin
    if (currentUser._id.toString() !== facultyId && !['hod', 'admin', 'principal'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own dashboard'
      });
    }

    // Get faculty profile
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    }).populate('userId', 'name email department');

    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty not found'
      });
    }

    // Get assigned classes from ClassAssignment model (handle both old and new schema)
    const classAssignments = await ClassAssignment.find({
      facultyId: facultyId,
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    }).populate('facultyId', 'name email');

    // Format assigned classes
    const assignedClasses = classAssignments.map(assignment => ({
      id: assignment._id,
      batch: assignment.batch,
      year: assignment.year,
      sem: assignment.semester,
      section: assignment.section,
      department: assignment.departmentId,
      assignedDate: assignment.assignedDate
    }));

    res.json({
      success: true,
      faculty: {
        name: faculty.userId.name,
        email: faculty.userId.email,
        department: faculty.userId.department,
        position: faculty.position,
        isClassAdvisor: faculty.is_class_advisor
      },
      assignedClasses: assignedClasses
    });

  } catch (error) {
    console.error('Error fetching faculty dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching faculty dashboard'
    });
  }
});

// @desc    Get students by batch, year, and semester for class advisor
// @route   GET /api/faculty/students?batch=2022-2026&year=2nd Year&semester=3&department=CSE
// @access  Faculty and above (Class Advisor)
router.get('/students', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, department } = req.query;
    const currentUser = req.user;

    console.log('🔍 Students request:', { batch, year, semester, department, userId: currentUser._id });

    if (!batch || !year || !semester || !department) {
      return res.status(400).json({
        success: false,
        message: 'Batch, year, semester, and department are required'
      });
    }

    // Validate and normalize semester
    let semesterNumber;
    if (typeof semester === 'string' && semester.startsWith('Sem')) {
      // Extract number from "Sem X" format
      const match = semester.match(/Sem\s*(\d+)/);
      if (match) {
        semesterNumber = parseInt(match[1]);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid semester format. Expected "Sem X" or number'
        });
      }
    } else {
      semesterNumber = parseInt(semester);
    }

    if (isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({
        success: false,
        message: 'Invalid semester. Must be a number between 1 and 8'
      });
    }

    console.log('🔍 Normalized semester:', { original: semester, normalized: semesterNumber });

    // Find the faculty record for the current user
    const faculty = await Faculty.findOne({ userId: currentUser._id });
    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty record not found'
      });
    }

    // Use unified service to fetch students
    const classContext = {
      batchYear: batch,
      year: year,
      semesterName: `Sem ${semesterNumber}`,
      section: 'A', // Default section for now
      department: department
    };

    const result = await getStudentsForFaculty(faculty._id, classContext);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error?.message || 'Error fetching students'
      });
    }

    const students = result.students;
    console.log(`📊 Found ${students.length} students for faculty`);

    // Map to expected response format
    const data = students.map(s => ({
      id: s.id,
      _id: s._id,
      rollNumber: s.rollNumber,
      name: s.name,
      email: s.email,
      mobile: s.mobile,
      parentContact: s.parentContact,
      address: s.address,
      dateOfBirth: s.dateOfBirth,
      emergencyContact: s.emergencyContact,
      batchYear: s.batchYear,
      department: s.department,
      section: s.section,
      currentSemester: s.currentSemester,
      userId: s.userId,
      createdBy: s.createdBy,
      createdAt: s.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: {
        students: data,
        total: data.length
      }
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/faculty/:id
// @access  HOD and above
router.get('/:id', hodAndAbove, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .select('-password')
      .populate('createdBy', 'name email');

    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: faculty
    });
  } catch (error) {
    console.error('Get faculty error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/faculty/:id/assignments
// @access  HOD and above
router.get('/:id/assignments', hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    const faculty = await Faculty.findById(id)
      .populate('userId', 'name email')
      .populate('createdBy', 'name email');

    if (!faculty) {
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    // Get class assignments for this faculty (handle both old and new schema)
    const assignments = await ClassAssignment.find({
      facultyId: faculty.userId,
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    }).populate('facultyId', 'name email');

    res.status(200).json({
      status: 'success',
      data: {
        faculty,
        assignments
      }
    });
  } catch (error) {
    console.error('Error fetching faculty assignments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching faculty assignments'
    });
  }
});

// @desc    Get faculty profile summary for navbar
// @route   GET /api/faculty/me/summary
// @access  Faculty
router.get('/me/summary', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log('📊 Faculty summary request from userId:', userId);
    
    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    console.log('👤 Faculty found:', faculty ? `${faculty.name} (${faculty._id})` : 'NOT FOUND');
    
    if (!faculty) {
      console.log('❌ Faculty profile not found for userId:', userId);
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    // Get assigned classes
    // NOTE: ClassAssignment stores facultyId as userId (from User collection), not faculty._id
    console.log('🔍 Searching for classes with facultyId (userId):', faculty.userId);
    const assignedClasses = await ClassAssignment.find({
      facultyId: faculty.userId,  // Use userId, not faculty._id
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    }).select('batch year semester section classId');
    
    console.log(`📚 Found ${assignedClasses.length} assigned classes`);

    // Count total students across all classes
    let totalStudents = 0;
    const activeSemesters = new Set();

    for (const cls of assignedClasses) {
      // Build the actual classId string that matches Student schema
      const classIdStr = `${cls.batch}_${cls.year}_${cls.semester}_${cls.section}`;
      
      console.log(`📊 Counting students for class: ${classIdStr}`);
      
      // Try multiple query strategies to find students
      const queries = [
        // New schema: students with semesters array
        {
          department: faculty.department,
          'semesters.classId': classIdStr,
          'semesters.status': 'active',
          status: 'active'
        },
        // Legacy schema: direct fields
        {
          department: faculty.department,
          batchYear: cls.batch,
          section: cls.section,
          'semesters.semesterName': cls.semester,
          'semesters.year': cls.year,
          status: 'active'
        },
        // Even simpler: just batch, year, semester, section
        {
          department: faculty.department,
          batchYear: cls.batch,
          section: cls.section,
          status: 'active'
        }
      ];
      
      let count = 0;
      for (const query of queries) {
        const tempCount = await Student.countDocuments(query);
        if (tempCount > count) {
          count = tempCount;
          console.log(`  ✓ Found ${count} students with query:`, JSON.stringify(query, null, 2));
        }
      }
      
      totalStudents += count;
      activeSemesters.add(`${cls.batch} | ${cls.year} | Sem ${cls.semester}`);
    }
    
    console.log(`📈 Total students across all classes: ${totalStudents}`);

    const responseData = {
      success: true,
      data: {
        profile: {
          id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          department: faculty.department,
          position: faculty.position || 'Faculty',
          role: faculty.is_class_advisor ? 'Class Advisor' : 'Faculty',
          joinedOn: faculty.createdAt,
          phone: faculty.phone,
          address: faculty.address,
          profilePhoto: faculty.profilePhoto,
          facultyId: faculty.facultyId || faculty._id.toString().slice(-6)
        },
        summary: {
          totalClasses: assignedClasses.length,
          totalStudents,
          activeSemesters: Array.from(activeSemesters),
          institution: 'Engineering College' // Can be made dynamic
        }
      }
    };

    console.log('✅ Sending faculty summary:', JSON.stringify(responseData, null, 2));

    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching faculty summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch faculty summary'
    });
  }
});

// @desc    Upload faculty profile photo
// @route   POST /api/faculty/me/photo
// @access  Faculty
router.post('/me/photo', authenticate, facultyAndAbove, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const userId = req.user._id;
    
    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      // Delete uploaded file if faculty not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    // Delete old photo if exists
    if (faculty.profilePhoto) {
      const oldPhotoPath = path.join(__dirname, '../uploads/profiles', path.basename(faculty.profilePhoto));
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    // Save new photo path
    faculty.profilePhoto = `/uploads/profiles/${req.file.filename}`;
    await faculty.save();

    console.log(`✅ Uploaded profile photo for faculty ${faculty.name}`);

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhoto: faculty.profilePhoto
      }
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('❌ Error uploading profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo'
    });
  }
});

// @desc    Delete faculty profile photo
// @route   DELETE /api/faculty/me/photo
// @access  Faculty
router.delete('/me/photo', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    // Delete photo file if exists
    if (faculty.profilePhoto) {
      const photoPath = path.join(__dirname, '../uploads/profiles', path.basename(faculty.profilePhoto));
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log(`🗑️ Deleted photo file: ${photoPath}`);
      }
    }

    // Remove photo reference from database
    faculty.profilePhoto = null;
    await faculty.save();

    console.log(`✅ Removed profile photo for faculty ${faculty.name}`);

    res.json({
      success: true,
      message: 'Profile photo deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting profile photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile photo'
    });
  }
});

// @desc    Update faculty profile
// @route   PUT /api/faculty/me/update
// @access  Faculty
router.put('/me/update', authenticate, facultyAndAbove, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('address').optional().trim()
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

    const userId = req.user._id;
    const { name, phone, address } = req.body;
    
    // Find faculty by userId
    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    // Update allowed fields only
    if (name) faculty.name = name;
    if (phone) faculty.phone = phone;
    if (address) faculty.address = address;

    await faculty.save();

    // Also update user name if changed
    if (name) {
      await User.findByIdAndUpdate(userId, { name });
    }

    console.log(`✅ Updated profile for faculty ${faculty.name}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        name: faculty.name,
        email: faculty.email,
        phone: faculty.phone,
        address: faculty.address,
        profilePhoto: faculty.profilePhoto
      }
    });

  } catch (error) {
    console.error('❌ Error updating faculty profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @desc    Delete faculty
// @route   DELETE /api/faculty/:id
// @access  HOD and above
router.delete('/:id', hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    
    console.log('🗑️ Delete faculty request:', {
      facultyId: id,
      requestedBy: currentUser._id,
      role: currentUser.role,
      department: currentUser.department
    });

    // Find the faculty record by _id
    const faculty = await Faculty.findById(id);
    
    if (!faculty) {
      console.log('❌ Faculty not found:', id);
      return res.status(404).json({
        status: 'error',
        message: 'Faculty not found'
      });
    }

    console.log('👤 Faculty found:', {
      id: faculty._id,
      name: faculty.name,
      email: faculty.email,
      department: faculty.department,
      userId: faculty.userId
    });

    // HODs can only delete faculty from their own department
    if (currentUser.role === 'hod' && faculty.department !== currentUser.department) {
      console.log('❌ Authorization failed: Department mismatch');
      return res.status(403).json({
        status: 'error',
        message: 'You can only delete faculty from your own department'
      });
    }

    // Prevent deleting faculty if they have active class assignments
    const activeAssignments = await ClassAssignment.countDocuments({
      facultyId: faculty.userId,
      $or: [
        { status: 'Active' },
        { status: { $exists: false }, active: true }
      ]
    });

    if (activeAssignments > 0) {
      console.log('⚠️ Cannot delete faculty with active assignments:', activeAssignments);
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete faculty with ${activeAssignments} active class assignment(s). Please remove all class assignments first.`
      });
    }

    // Delete the faculty record
    await Faculty.findByIdAndDelete(id);
    console.log('✅ Faculty record deleted:', id);

    // Delete the corresponding user record
    if (faculty.userId) {
      await User.findByIdAndDelete(faculty.userId);
      console.log('✅ User record deleted:', faculty.userId);
    }

    // Deactivate any remaining class assignments (safety measure)
    await ClassAssignment.updateMany(
      { facultyId: faculty.userId },
      { 
        $set: { 
          status: 'Inactive',
          active: false,
          deactivatedDate: new Date(),
          deactivatedBy: currentUser._id
        }
      }
    );

    console.log(`✅ Faculty and user deleted successfully: ${faculty.name} (${faculty.email})`);

    res.status(200).json({
      status: 'success',
      message: 'Faculty deleted successfully',
      data: {
        id: faculty._id,
        name: faculty.name,
        email: faculty.email
      }
    });

  } catch (error) {
    console.error('❌ Delete faculty error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while deleting faculty',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

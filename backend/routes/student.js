import express from 'express';
import { body, validationResult } from 'express-validator';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import { resolveFacultyId, validateFacultyClassBinding, createAuditLog } from '../services/facultyResolutionService.js';
import { getStudentsForFaculty, createOrUpdateStudent } from '../services/unifiedStudentService.js';

const router = express.Router();

// All student routes require authentication
// Note: facultyAndAbove authorization is applied individually to routes that need it
router.use(authenticate);

// Helper: normalize year and semester inputs to stored format
const normalizeYear = (yearInput) => {
  if (!yearInput) return undefined;
  const asString = String(yearInput).trim();
  if (/^\d+$/.test(asString)) {
    const n = parseInt(asString, 10);
    if (n === 1) return '1st Year';
    if (n === 2) return '2nd Year';
    if (n === 3) return '3rd Year';
    if (n === 4) return '4th Year';
  }
  if (/^\d(st|nd|rd|th)\s*Year$/i.test(asString)) return asString.replace(/\s+/g, ' ');
  if (['1st', '2nd', '3rd', '4th'].includes(asString)) {
    return `${asString} Year`;
  }
  return asString; // fallback
};

const normalizeSemester = (semInput) => {
  if (!semInput && semInput !== 0) return undefined;
  const asString = String(semInput).trim();
  if (/^\d+$/.test(asString)) {
    return `Sem ${parseInt(asString, 10)}`;
  }
  if (/^Sem\s*\d$/i.test(asString)) {
    const n = asString.match(/\d+/)?.[0];
    return `Sem ${n}`;
  }
  return asString; // fallback
};

const parseYearNumber = (normalizedYear) => {
  if (!normalizedYear) return undefined;
  const m = String(normalizedYear).match(/^(\d)(st|nd|rd|th)\s*Year$/i);
  if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(String(normalizedYear))) return parseInt(normalizedYear, 10);
  return undefined;
};

const parseSemesterNumber = (normalizedSemester) => {
  if (!normalizedSemester) return undefined;
  const m = String(normalizedSemester).match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return undefined;
};

// @desc    Fetch students for assigned class (by batch/year/semester[/section])
// @route   GET /api/students?batch=YYYY-YYYY&year=2nd%20Year|1&semester=3|Sem%203[&section=A]
// @access  Faculty (Class Advisor) and above
router.get('/', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section } = req.query;
    if (!batch || !year || !semester) {
      return res.status(400).json({
        success: false,
        message: 'batch, year, and semester are required'
      });
    }

    console.log('🔍 [STUDENT QUERY] Raw params:', { batch, year, semester, section, userId: req.user._id, role: req.user.role });

    const normalizedYear = normalizeYear(year);
    const normalizedSemester = normalizeSemester(semester);

    console.log('🔍 [STUDENT QUERY] Normalized:', { normalizedYear, normalizedSemester });

    // Use unified service to fetch students
    const classContext = {
      batchYear: batch,
      year: normalizedYear,
      semesterName: normalizedSemester,
      section: section || null, // Don't default to 'A' - query all sections if not provided
      department: req.user.department
    };

    console.log('🔍 [STUDENT QUERY] Class context:', JSON.stringify(classContext, null, 2));

    // req.user._id is the User ID (from authentication), which is stored in semesters.facultyId
    const result = await getStudentsForFaculty(req.user._id, classContext);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error?.message || 'Error fetching students'
      });
    }

    const students = result.students;
    const classId = `${batch}_${normalizedYear}_${normalizedSemester}_${section || 'A'}`;

    console.log(`📊 Found ${students.length} students for class ${classId}`);
    
    // Map to expected response shape using unified format
    const yearNumber = parseYearNumber(normalizedYear);
    const semesterNumber = parseSemesterNumber(normalizedSemester);
    const data = students.map(s => ({
      id: s.id,
      _id: s._id,
      userId: s.userId,
      roll_number: s.rollNumber,
      rollNumber: s.rollNumber,
      full_name: s.name,
      name: s.name,
      email: s.email,
      mobile_number: s.mobile || '',
      mobile: s.mobile || '',
      department: s.department,
      batchYear: s.batchYear,
      year: yearNumber,
      semester: semesterNumber,
      section: s.section,
      classId: s.currentSemester?.classAssigned || '',
      facultyId: s.currentSemester?.facultyId || '',
      createdBy: s.createdBy,
      createdAt: s.createdAt,
      parentContact: s.parentContact || '',
      address: s.address || '',
      dateOfBirth: s.dateOfBirth,
      emergencyContact: s.emergencyContact
    }));

    return res.status(200).json({
      success: true,
      data: {
        students: data,
        total: data.length
      }
    });
  } catch (error) {
    console.error('GET /api/students error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Create new student
// @route   POST /api/students
// @access  Faculty (Class Advisor) and above
router.post('/', authenticate, facultyAndAbove, [
  body('roll_number').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('rollNumber').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('rollNo').optional().isString().trim().isLength({ min: 1 }).withMessage('Roll number is required'),
  body('full_name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile_number').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be 10 digits'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be 10 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('batch').matches(/^\d{4}-\d{4}$/).withMessage('Batch must be in format YYYY-YYYY'),
  body('year').exists().withMessage('Year is required'),
  body('semester').exists().withMessage('Semester is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const bodyData = req.body;
    const rollNumber = (bodyData.roll_number || bodyData.rollNumber || bodyData.rollNo || '').trim();
    const name = (bodyData.full_name || bodyData.name || '').trim();
    const email = String(bodyData.email).toLowerCase().trim();
    const mobile = (bodyData.mobile_number || bodyData.mobile || '').trim();
    const password = String(bodyData.password);
    const batch = String(bodyData.batch).trim();
    const normalizedYear = normalizeYear(bodyData.year);
    const normalizedSemester = normalizeSemester(bodyData.semester);

    if (!rollNumber) {
      return res.status(400).json({ success: false, message: 'Missing roll_number' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'Missing full_name' });
    }
    if (!email) {
      return res.status(400).json({ success: false, message: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Missing password' });
    }

    // Validate year-semester combination
    const yearNumber = parseYearNumber(normalizedYear);
    const semesterNumber = parseSemesterNumber(normalizedSemester);
    
    if (yearNumber && semesterNumber) {
      const validSemesters = {
        1: [1, 2],
        2: [3, 4],
        3: [5, 6],
        4: [7, 8]
      };
      
      if (!validSemesters[yearNumber] || !validSemesters[yearNumber].includes(semesterNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year-semester combination. Please select valid semester for the chosen year.'
        });
      }
    }

    // Resolve faculty ID using centralized service
    const classId = `${batch}_${normalizedYear}_${normalizedSemester}_${bodyData.section || 'A'}`;
    
    const facultyResolution = await resolveFacultyId({
      user: req.user,
      classId,
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      section: bodyData.section || 'A',
      department: req.user.department
    });
    
    const { facultyId, faculty, source } = facultyResolution;
    
    console.log('👨‍🏫 Faculty resolved for manual creation:', {
      facultyId,
      source,
      facultyName: faculty.name
    });
    
    // Validate faculty-class binding
    const classMetadata = {
      batch,
      year: normalizedYear,
      semester: normalizedSemester,
      section: bodyData.section || 'A',
      department: req.user.department
    };
    
    const isValidBinding = await validateFacultyClassBinding(facultyId, classId, classMetadata);
    
    if (!isValidBinding) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not authorized for this class'
      });
    }
    
    // Create audit log
    await createAuditLog({
      operation: 'manual_create',
      facultyId,
      classId,
      source,
      userId: req.user._id,
      details: {
        batch,
        year: normalizedYear,
        semester: normalizedSemester,
        section: bodyData.section || 'A',
        department: req.user.department,
        facultyName: faculty.name,
        validationPassed: true
      }
    });

    // Prepare student data for unified service
    const studentData = {
      name,
      email,
      rollNumber,
      mobile,
      password,
      parentContact: bodyData.parentContact || '',
      address: bodyData.address || '',
      dateOfBirth: bodyData.dateOfBirth || null,
      emergencyContact: bodyData.emergencyContact || null
    };

    // Prepare class context for unified service
    const classContext = {
      batchYear: batch,
      year: normalizedYear,
      semesterName: normalizedSemester,
      section: bodyData.section || 'A',
      department: req.user.department,
      facultyId: facultyId
    };

    // Use unified service to create or update student
    console.log('📝 Creating student with context:', {
      studentName: studentData.name,
      batchYear: classContext.batchYear,
      year: classContext.year,
      semesterName: classContext.semesterName,
      section: classContext.section
    });
    
    const result = await createOrUpdateStudent(studentData, classContext, facultyId, req.user._id);

    if (!result.success) {
      console.error('❌ Student creation failed:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message,
        details: result.conflictDetails || null
      });
    }
    
    // Log the created student to verify semesters array
    console.log('✅ Student creation result:', {
      action: result.action,
      studentId: result.student._id,
      studentName: result.student.name,
      semestersCount: result.student.semesters?.length || 0,
      semesters: result.student.semesters?.map(s => ({
        name: s.semesterName,
        classId: s.classId
      })) || []
    });

    // Create final audit log with student details
    await createAuditLog({
      operation: 'manual_create',
      facultyId,
      classId,
      source,
      userId: req.user._id,
      studentCount: 1,
      studentIds: [result.student._id],
      details: {
        batch,
        year: normalizedYear,
        semester: normalizedSemester,
        section: bodyData.section || 'A',
        department: req.user.department,
        facultyName: faculty.name,
        validationPassed: true,
        studentName: result.student.name,
        studentRollNumber: result.student.rollNumber
      },
      status: 'success'
    });

    const response = {
      id: result.student._id,
      roll_number: result.student.rollNumber,
      full_name: result.student.name,
      email: result.student.email,
      mobile_number: result.student.mobile || '',
      department: result.student.department,
      batchYear: result.student.batchYear,
      year: yearNumber,
      semester: semesterNumber,
      action: result.action
    };

    const message = result.action === 'created' ? 'Student created successfully' :
                   result.action === 'updated' ? 'Student semester added successfully' :
                   'Student processed successfully';

    return res.status(201).json({ success: true, message, data: response });
  } catch (error) {
    console.error('POST /api/students error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate entry' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


// @desc    Create new student
// @route   POST /api/student/create
// @route   POST /api/students/add (alias)
// @access  Faculty and above
router.post('/create', authenticate, facultyAndAbove, [
  body('rollNumber').trim().isLength({ min: 1, max: 20 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('classAssigned').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class assignment'),
  body('year').isIn(['1st', '2nd', '3rd', '4th']).withMessage('Invalid year'),
  body('semester').isIn(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']).withMessage('Invalid semester')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rollNumber, name, email, password, mobile, classAssigned, year, semester } = req.body;
    const currentUser = req.user;

    // Check if email already exists across system
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }

    // Find faculty assigned to this class
    const assignedFaculty = await Faculty.findOne({ 
      assignedClass: classAssigned,
      department: currentUser.department,
      status: 'active'
    });

    if (!assignedFaculty) {
      return res.status(400).json({
        status: 'error',
        message: 'No faculty assigned to this class'
      });
    }

    // Create corresponding user for the student
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: 'student',
      department: currentUser.department,
      class: classAssigned,
      createdBy: currentUser._id
    });
    await user.save();

    // Extract section from classAssigned (e.g., '1A' -> 'A')
    const section = classAssigned.replace(/\d/g, '');
    
    // Generate batch year
    const currentYear = new Date().getFullYear();
    const batch = `${currentYear}-${currentYear + 4}`;
    
    // Generate classId in same format as bulk upload: batch_year_semester_section
    const classIdForSemester = `${batch}_${year}_${semester}_${section}`;
    
    console.log('🏫 Generated classId:', classIdForSemester);
    
    // Create semester entry for the semesters array
    const semesterEntry = {
      semesterName: semester,
      year: year,
      section: section,
      batch: batch,
      department: currentUser.department,
      facultyId: assignedFaculty._id,
      classAssigned: classAssigned,
      classId: classIdForSemester,
      status: 'active',
      createdBy: currentUser._id
    };

    // Create student details and link userId
    const student = new Student({
      userId: user._id,
      rollNumber,
      name,
      email: email.toLowerCase(),
      mobile,
      parentContact: mobile, // Use mobile as parent contact if not provided separately
      department: currentUser.department,
      batchYear: batch,
      section: section,
      
      // Populate semesters array with first semester
      semesters: [semesterEntry],
      
      // Also keep old fields for backward compatibility
      classAssigned,
      year,
      semester,
      facultyId: assignedFaculty._id,
      classId: classIdForSemester,
      
      status: 'active',
      createdBy: currentUser._id
    });
    await student.save();
    
    console.log('✅ Student created with semesters array:', {
      studentId: student._id,
      name: student.name,
      semestersCount: student.semesters.length,
      firstSemester: student.semesters[0]?.semesterName
    });

    const studentResponse = student.toObject();

    res.status(201).json({
      status: 'success',
      message: 'Student added successfully',
      data: studentResponse
    });
  } catch (error) {
    console.error('Create student error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Create new student (alias route)
// @route   POST /api/students/add
// @access  Faculty and above
router.post('/add', authenticate, facultyAndAbove, [
  body('rollNo').trim().isLength({ min: 1, max: 20 }).withMessage('Roll number is required'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('classId').isIn(['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']).withMessage('Invalid class assignment')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rollNo, name, email, mobile, classId } = req.body;
    const currentUser = req.user;

    // Check if email already exists across system
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }

    // Find faculty assigned to this class
    const assignedFaculty = await Faculty.findOne({ 
      assignedClass: classId,
      department: currentUser.department,
      status: 'active'
    });

    if (!assignedFaculty) {
      return res.status(400).json({
        status: 'error',
        message: 'No faculty assigned to this class'
      });
    }

    // Create corresponding user for the student
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: 'defaultPassword123', // Default password for alias route
      role: 'student',
      department: currentUser.department,
      class: classId,
      createdBy: currentUser._id
    });
    await user.save();

    // Extract section from classId (e.g., '1A' -> 'A')
    const section = classId.replace(/\d/g, '');
    const yearNumber = classId.replace(/\D/g, ''); // Extract number from classId
    
    // Generate year with suffix
    const yearWithSuffix = `${yearNumber}${yearNumber === '1' ? 'st' : yearNumber === '2' ? 'nd' : yearNumber === '3' ? 'rd' : 'th'} Year`;
    
    // Generate batch year
    const currentYear = new Date().getFullYear();
    const batch = `${currentYear}-${currentYear + 4}`;
    
    // Generate classId in same format as bulk upload: batch_year_semester_section
    const classIdForSemester = `${batch}_${yearWithSuffix}_Sem 1_${section}`;
    
    console.log('🏫 Generated classId:', classIdForSemester);
    
    // Create semester entry for the semesters array
    const semesterEntry = {
      semesterName: 'Sem 1',
      year: yearWithSuffix,
      section: section,
      batch: batch,
      department: currentUser.department,
      facultyId: assignedFaculty._id,
      classAssigned: classId,
      classId: classIdForSemester,
      status: 'active',
      createdBy: currentUser._id
    };

    // Create student details and link userId
    const student = new Student({
      userId: user._id,
      rollNumber: rollNo,
      name,
      email: email.toLowerCase(),
      mobile,
      parentContact: mobile, // Use mobile as parent contact if not provided separately
      department: currentUser.department,
      batchYear: batch,
      section: section,
      
      // Populate semesters array with first semester
      semesters: [semesterEntry],
      
      // Also keep old fields for backward compatibility
      classAssigned: classId,
      year: yearWithSuffix,
      semester: 'Sem 1',
      facultyId: assignedFaculty._id,
      classId: classIdForSemester,
      
      status: 'active',
      createdBy: currentUser._id
    });
    await student.save();
    
    console.log('✅ Student created with semesters array:', {
      studentId: student._id,
      name: student.name,
      semestersCount: student.semesters.length,
      firstSemester: student.semesters[0]?.semesterName
    });

    res.status(201).json({
      message: 'Student added successfully',
      studentId: student._id
    });
  } catch (error) {
    console.error('Create student (alias) error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Student already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Update student details
// @route   PUT /api/students/:id
// @access  Faculty (Class Advisor) and above
router.put('/:id', authenticate, facultyAndAbove, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('parentContact').optional().matches(/^[0-9]{10}$/).withMessage('Parent contact must be exactly 10 digits'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { id } = req.params;
    const { name, email, mobile, parentContact, password } = req.body;

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Verify faculty is authorized to edit this student
    const faculty = await Faculty.findOne({
      userId: req.user._id,
      is_class_advisor: true,
      batch: student.batch,
      year: student.year,
      semester: parseInt(String(student.semester).match(/\d+/)?.[0] || '0', 10),
      department: req.user.department,
      status: 'active'
    });

    if (!faculty || faculty._id.toString() !== student.facultyId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this student'
      });
    }

    // Check for email uniqueness if email is being updated
    if (email && email !== student.email) {
      const existingStudent = await Student.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id }
      });
      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists for another student'
        });
      }
    }

    // Update student details
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase();
    if (mobile) updateData.mobile = mobile;
    if (parentContact) updateData.parentContact = parentContact;

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('userId rollNumber name email mobile parentContact year semester batch department');

    // Update corresponding user record
    const userUpdateData = {};
    if (name) userUpdateData.name = name.trim();
    if (email) userUpdateData.email = email.toLowerCase();
    if (password) userUpdateData.password = password; // Will be hashed by pre-save hook

    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(student.userId, userUpdateData, { runValidators: true });
    }

    // Log the update
    console.log(`Student updated by faculty ${req.user._id}: ${student.rollNumber} - ${student.name}`);

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: {
        id: updatedStudent._id,
        rollNumber: updatedStudent.rollNumber,
        name: updatedStudent.name,
        email: updatedStudent.email,
        mobile: updatedStudent.mobile || '',
        parentContact: updatedStudent.parentContact || '',
        department: updatedStudent.department,
        batch: updatedStudent.batch,
        year: updatedStudent.year,
        semester: updatedStudent.semester
      }
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Remove student from specific semester
// @route   DELETE /api/students/:id/semester
// @access  Faculty (Class Advisor) and above
router.delete('/:id/semester', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const { semesterName, year, section, department } = req.body;
    
    console.log('🗑️ Remove student from semester request:', {
      studentId: id,
      facultyId: req.user._id,
      facultyRole: req.user.role,
      facultyDepartment: req.user.department,
      targetSemester: { semesterName, year, section, department }
    });

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      console.log('❌ Student not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    console.log('👤 Student found:', {
      id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      createdBy: student.createdBy,
      semesters: student.semesters?.length || 0
    });

    // Check if student has any semesters
    if (!student.semesters || student.semesters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student is not enrolled in any semesters'
      });
    }

    // Find the specific semester to remove
    const semesterToRemove = student.semesters.find(sem => 
      sem.semesterName === semesterName && 
      sem.year === year && 
      sem.section === section
    );

    if (!semesterToRemove) {
      return res.status(404).json({
        success: false,
        message: `Student is not enrolled in ${semesterName} ${year} Section ${section}`
      });
    }

    // Verify faculty is authorized to remove from this semester
    const isCreator = student.createdBy && student.createdBy.toString() === req.user._id.toString();
    const isAssignedFaculty = semesterToRemove.facultyId && semesterToRemove.facultyId.toString() === req.user._id.toString();
    const hasDepartmentAccess = student.department === req.user.department;
    
    console.log('🔐 Authorization check:', {
      isCreator,
      isAssignedFaculty,
      hasDepartmentAccess,
      semesterFacultyId: semesterToRemove.facultyId,
      currentFacultyId: req.user._id
    });
    
    if (!isCreator && !isAssignedFaculty) {
      console.log('❌ Authorization failed: Not creator or assigned faculty for this semester');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove this student from this semester'
      });
    }
    
    if (!hasDepartmentAccess) {
      console.log('❌ Authorization failed: Department mismatch');
      return res.status(403).json({
        success: false,
        message: 'You can only remove students from your department'
      });
    }
    
    console.log('✅ Authorization passed');

    // Remove the specific semester from the array
    const updatedSemesters = student.semesters.filter(sem => 
      !(sem.semesterName === semesterName && 
        sem.year === year && 
        sem.section === section)
    );

    console.log('📚 Semesters before removal:', student.semesters.length);
    console.log('📚 Semesters after removal:', updatedSemesters.length);

    // Update the student with the filtered semesters array
    const updatedStudent = await Student.findByIdAndUpdate(
      id, 
      { 
        semesters: updatedSemesters,
        updatedAt: new Date()
      },
      { new: true }
    );

    // If no semesters left, mark student as inactive
    if (updatedSemesters.length === 0) {
      await Student.findByIdAndUpdate(id, {
        status: 'inactive',
        deletedAt: new Date(),
        deletedBy: req.user._id
      });
      
      // Also mark user as inactive
      await User.findByIdAndUpdate(student.userId, {
        status: 'inactive',
        deletedAt: new Date(),
        deletedBy: req.user._id
      });
      
      console.log('⚠️ Student marked as inactive - no semesters remaining');
    }

    console.log(`✅ Student removed from ${semesterName} ${year} Section ${section}`);
    console.log(`📊 Remaining semesters: ${updatedSemesters.length}`);

    res.json({
      success: true,
      message: `Student removed from ${semesterName} ${year} Section ${section} successfully`,
      data: {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        semesterRemoved: true,
        remainingSemesters: updatedSemesters.length,
        isStudentInactive: updatedSemesters.length === 0
      }
    });

  } catch (error) {
    console.error('Remove student from semester error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during semester removal'
    });
  }
});

// @desc    Delete student completely (removes from all semesters - use with caution)
// @route   DELETE /api/students/:id
// @access  Faculty (Class Advisor) and above
// @note    This completely removes the student from all semesters. 
//          For semester-specific removal, use DELETE /api/students/:id/semester
router.delete('/:id', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Delete student request:', {
      studentId: id,
      facultyId: req.user._id,
      facultyRole: req.user.role,
      facultyDepartment: req.user.department
    });

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      console.log('❌ Student not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    console.log('👤 Student found:', {
      id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      createdBy: student.createdBy,
      facultyId: student.facultyId,
      semesters: student.semesters?.length || 0
    });

    // Verify faculty is authorized to delete this student
    // Check if faculty is the creator of the student or has permission
    const isCreator = student.createdBy && student.createdBy.toString() === req.user._id.toString();
    
    // Check if faculty is assigned to any of the student's semesters
    let isAssignedFaculty = false;
    if (student.semesters && student.semesters.length > 0) {
      isAssignedFaculty = student.semesters.some(sem => 
        sem.facultyId && sem.facultyId.toString() === req.user._id.toString()
      );
    }
    
    // Check if faculty is assigned to the student (legacy support)
    const isLegacyAssignedFaculty = student.facultyId && student.facultyId.toString() === req.user._id.toString();
    
    // Check department access
    const hasDepartmentAccess = student.department === req.user.department;
    
    console.log('🔐 Authorization check:', {
      isCreator,
      isAssignedFaculty,
      isLegacyAssignedFaculty,
      hasDepartmentAccess,
      studentDepartment: student.department,
      facultyDepartment: req.user.department
    });
    
    if (!isCreator && !isAssignedFaculty && !isLegacyAssignedFaculty) {
      console.log('❌ Authorization failed: Not creator or assigned faculty');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this student. Only the assigned faculty or creator can delete students.'
      });
    }
    
    if (!hasDepartmentAccess) {
      console.log('❌ Authorization failed: Department mismatch');
      return res.status(403).json({
        success: false,
        message: 'You can only delete students from your department.'
      });
    }
    
    console.log('✅ Authorization passed');

    // Log current semesters before deletion
    console.log('📚 Current semesters before deletion:', student.semesters?.length || 0, 'semesters');
    if (student.semesters && student.semesters.length > 0) {
      console.log('📚 Semester details:', student.semesters.map(sem => ({
        semesterName: sem.semesterName,
        year: sem.year,
        section: sem.section,
        facultyId: sem.facultyId
      })));
    }

    // Soft delete: Mark student as inactive and clear semesters array
    await Student.findByIdAndUpdate(id, { 
      status: 'inactive',
      deletedAt: new Date(),
      deletedBy: req.user._id,
      semesters: [], // Clear the semesters array upon deletion
      // Also clear legacy fields for consistency
      classId: null,
      classAssigned: null,
      year: null,
      semester: null,
      facultyId: null
    });
    
    console.log('🗑️ Student semesters array cleared successfully');

    // Also mark user as inactive
    await User.findByIdAndUpdate(student.userId, { 
      status: 'inactive',
      deletedAt: new Date(),
      deletedBy: req.user._id
    });
    
    // Remove student from any attendance records (optional - for data integrity)
    // This ensures the student doesn't appear in attendance lists after deletion
    try {
      await Attendance.updateMany(
        { studentId: student.userId },
        { $set: { status: 'deleted', deletedAt: new Date() } }
      );
    } catch (attendanceError) {
      console.log('Note: Could not update attendance records for deleted student:', attendanceError.message);
    }

    // Log the deletion
    console.log(`Student soft deleted by faculty ${req.user._id}: ${student.rollNumber} - ${student.name}`);
    console.log(`✅ Semesters array cleared for student: ${student.rollNumber}`);

    res.json({
      success: true,
      message: 'Student deleted successfully. All semester enrollments have been removed.',
      data: {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        semestersCleared: true
      }
    });

  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get students by class
// @route   GET /api/student/list/:classAssigned
// @access  Faculty and above
router.get('/list/:classAssigned', async (req, res) => {
  try {
    const { classAssigned } = req.params;
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search;

    // Build filter object
    const filter = { 
      classAssigned,
      department: currentUser.department
    };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const students = await Student.find(filter)
      .select('-password')
      .populate('facultyId', 'name position')
      .populate('createdBy', 'name email')
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Student.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        students,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          limit
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get students by class (alt route)
// @route   GET /api/students/class/:classAssigned
// @access  Faculty and above
router.get('/class/:classAssigned', async (req, res) => {
  try {
    const { classAssigned } = req.params;
    const currentUser = req.user;
    const students = await Student.find({ 
      classAssigned, 
      department: currentUser.department, 
      createdBy: currentUser._id, // Only show students created by current faculty
      status: 'active' 
    })
      .select('rollNumber name email mobile year semester')
      .sort({ rollNumber: 1 });

    res.status(200).json({
      status: 'success',
      data: { students }
    });
  } catch (error) {
    console.error('Get students (class) error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});


// @desc    Update student details (comprehensive)
// @route   PUT /api/students/:id
// @access  Faculty and above
router.put('/:id', [
  body('rollNumber').notEmpty().withMessage('Roll number is required'),
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('mobile').isLength({ min: 10, max: 10 }).withMessage('Mobile number must be 10 digits'),
  body('batch').notEmpty().withMessage('Batch is required'),
  body('year').notEmpty().withMessage('Year is required'),
  body('semester').notEmpty().withMessage('Semester is required'),
  body('section').optional().trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { rollNumber, name, email, mobile, batch, year, semester, section } = req.body;
    const currentUser = req.user;

    // Find the student
    const student = await Student.findById(req.params.id).populate('userId');
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Check if roll number is being changed and if it already exists in the same class
    if (rollNumber !== student.rollNumber) {
      const existingStudent = await Student.findOne({
        rollNumber: rollNumber.trim(),
        batch,
        year: normalizeYear(year),
        semester: normalizeSemester(semester),
        department: currentUser.department,
        _id: { $ne: req.params.id }
      });

      if (existingStudent) {
        return res.status(400).json({
          status: 'error',
          message: 'Roll number already exists in this class'
        });
      }
    }

    // Check if email is being changed and if it already exists
    if (email !== student.userId.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: student.userId._id }
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already exists'
        });
      }
    }

    // Update User model
    const updatedUser = await User.findByIdAndUpdate(
      student.userId._id,
      {
        name: name.trim(),
        email: email.toLowerCase(),
        mobile: mobile.trim()
      },
      { new: true, runValidators: true }
    );

    // Update Student model
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        rollNumber: rollNumber.trim(),
        batch: batch.trim(),
        year: normalizeYear(year),
        semester: normalizeSemester(semester),
        section: section ? section.trim() : undefined,
        mobile: mobile.trim()
      },
      { new: true, runValidators: true }
    ).populate('userId', 'name email mobile');

    console.log('✅ Student updated successfully:', {
      studentId: updatedStudent._id,
      rollNumber: updatedStudent.rollNumber,
      name: updatedUser.name,
      email: updatedUser.email
    });

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: {
        _id: updatedStudent._id,
        rollNumber: updatedStudent.rollNumber,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        batch: updatedStudent.batch,
        year: updatedStudent.year,
        semester: updatedStudent.semester,
        section: updatedStudent.section,
        userId: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          mobile: updatedUser.mobile
        }
      }
    });
  } catch (error) {
    console.error('❌ Update student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Update student (legacy endpoint)
// @route   PUT /api/student/update/:id
// @access  Faculty and above
router.put('/update/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Update student fields
    const updateData = { ...req.body };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});


// @desc    Test route for class management
// @route   GET /api/classes/test
// @access  Faculty and above
router.get('/classes/test', authenticate, facultyAndAbove, (req, res) => {
  res.json({ 
    message: 'Class management route is working', 
    user: req.user.name,
    department: req.user.department,
    timestamp: new Date().toISOString()
  });
});

// @desc    Get detailed student profile for faculty
// @route   GET /api/students/:id/profile-detailed
// @access  Faculty and above
router.get('/:id/profile-detailed', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log('👤 Fetching detailed student profile for ID:', id);
    console.log('👤 Faculty:', req.user.email, 'Department:', req.user.department);

    // Get student basic info with populated data
    let student = await Student.findById(id)
      .populate('userId', 'name email mobile')
      .populate('createdBy', 'name email')
      .populate('semesters.facultyId', 'name email');

    if (!student) {
      console.log('❌ Student not found for ID:', id);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Check department access
    if (student.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view students from your department.'
      });
    }

    // Build date filter for attendance
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else {
      // Default to current academic year
      const currentYear = new Date().getFullYear();
      const academicYearStart = new Date(currentYear, 7, 1); // August 1st
      const academicYearEnd = new Date(currentYear + 1, 6, 31); // July 31st next year
      dateFilter = { $gte: academicYearStart, $lte: academicYearEnd };
    }

    // Get attendance records for the student
    const studentUserId = student.userId._id;
    const attendanceRecords = await Attendance.find({
      studentId: studentUserId,
      date: dateFilter
    }).sort({ date: 1 });

    // Get holidays in the same date range
    const Holiday = (await import('../models/Holiday.js')).default;
    
    let holidayDateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate).toISOString().split('T')[0];
      const end = new Date(endDate).toISOString().split('T')[0];
      holidayDateFilter = { $gte: start, $lte: end };
    } else {
      const currentYear = new Date().getFullYear();
      const academicYearStart = `${currentYear}-08-01`;
      const academicYearEnd = `${currentYear + 1}-07-31`;
      holidayDateFilter = { $gte: academicYearStart, $lte: academicYearEnd };
    }
    
    const holidays = await Holiday.find({
      department: student.department,
      holidayDate: holidayDateFilter,
      isActive: true
    }).select('holidayDate reason');

    // Create holiday dates set
    const holidayDates = new Set(holidays.map(h => 
      typeof h.holidayDate === 'string' ? h.holidayDate : h.holidayDate.toISOString().split('T')[0]
    ));

    // Calculate attendance statistics
    const workingDaysRecords = attendanceRecords.filter(record => {
      const recordDate = record.date.toISOString().split('T')[0];
      return !holidayDates.has(recordDate) && record.status !== 'Not Marked';
    });

    const totalDays = workingDaysRecords.length;
    const presentDays = workingDaysRecords.filter(record => record.status === 'Present').length;
    const absentDays = workingDaysRecords.filter(record => record.status === 'Absent').length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Group attendance by month for calendar view
    const monthlyAttendance = {};
    
    attendanceRecords.forEach(record => {
      const monthKey = record.date.toISOString().slice(0, 7); // YYYY-MM format
      if (!monthlyAttendance[monthKey]) {
        monthlyAttendance[monthKey] = [];
      }
      monthlyAttendance[monthKey].push({
        date: record.date.toISOString().split('T')[0],
        status: record.status,
        reason: record.reason || '',
        actionTaken: record.actionTaken || ''
      });
    });

    // Add holidays to monthly attendance
    holidays.forEach(holiday => {
      const holidayDateStr = typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0];
      const monthKey = holidayDateStr.slice(0, 7);
      if (!monthlyAttendance[monthKey]) {
        monthlyAttendance[monthKey] = [];
      }
      monthlyAttendance[monthKey].push({
        date: holidayDateStr,
        status: 'Holiday',
        reason: holiday.reason,
        actionTaken: ''
      });
    });

    // Get recent attendance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAttendance = attendanceRecords.filter(record => record.date >= thirtyDaysAgo);

    // Prepare response
    const response = {
      success: true,
      data: {
        // Student basic info
        student: {
          id: student._id,
          userId: student.userId._id,
          rollNumber: student.rollNumber,
          name: student.userId.name,
          email: student.userId.email,
          mobile: student.mobile || student.userId.mobile || 'N/A',
          parentContact: student.parentContact || 'N/A',
          address: student.address || 'N/A',
          dateOfBirth: student.dateOfBirth || null,
          emergencyContact: student.emergencyContact || null,
          department: student.department,
          batchYear: student.batchYear,
          section: student.section,
          status: student.status,
          createdBy: student.createdBy,
          createdAt: student.createdAt,
          updatedAt: student.updatedAt
        },
        // Academic info
        academic: {
          semesters: student.semesters || [],
          totalSemesters: student.semesters?.length || 0,
          currentSemester: student.semesters?.find(sem => sem.status === 'active') || null
        },
        // Attendance statistics
        attendanceStats: {
          totalDays,
          presentDays,
          absentDays,
          attendancePercentage,
          recentDays: recentAttendance.length
        },
        // Monthly attendance data for calendar
        monthlyAttendance,
        // Recent attendance for quick view
        recentAttendance: recentAttendance.map(record => ({
          date: record.date.toISOString().split('T')[0],
          status: record.status,
          reason: record.reason || '',
          actionTaken: record.actionTaken || ''
        })),
        // Holidays
        holidays: holidays.map(holiday => ({
          date: typeof holiday.holidayDate === 'string' ? holiday.holidayDate : holiday.holidayDate.toISOString().split('T')[0],
          reason: holiday.reason
        }))
      }
    };

    console.log('✅ Student profile data fetched successfully');
    res.json(response);

  } catch (error) {
    console.error('Get detailed student profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student profile' 
    });
  }
});

// @desc    Update student information (limited fields)
// @route   PUT /api/students/:id/update
// @access  Faculty and above
router.put('/:id/update', authenticate, facultyAndAbove, [
  body('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('mobile').optional().isLength({ min: 10, max: 10 }).withMessage('Mobile must be exactly 10 digits'),
  body('parentContact').optional().isLength({ min: 10, max: 10 }).withMessage('Parent contact must be exactly 10 digits'),
  body('address').optional().isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format'),
  body('emergencyContact').optional().isLength({ min: 10, max: 10 }).withMessage('Emergency contact must be exactly 10 digits'),
  body('department').optional().isIn(['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AERO']).withMessage('Invalid department'),
  body('semester').optional().isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  body('section').optional().isLength({ min: 1, max: 2 }).withMessage('Section must be 1-2 characters')
], async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('✏️ Update student request:', {
      studentId: id,
      facultyId: req.user._id,
      facultyRole: req.user.role,
      facultyDepartment: req.user.department,
      updateFields: Object.keys(updateData)
    });

    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      console.log('❌ Student not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check department access
    if (student.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update students from your department.'
      });
    }

    // Check if faculty is authorized to update this student
    const isCreator = student.createdBy && student.createdBy.toString() === req.user._id.toString();
    const isAssignedFaculty = student.semesters?.some(sem => 
      sem.facultyId && sem.facultyId.toString() === req.user._id.toString()
    );
    
    console.log('🔐 Authorization check:', {
      isCreator,
      isAssignedFaculty,
      studentCreatedBy: student.createdBy,
      currentFacultyId: req.user._id,
      studentSemesters: student.semesters?.map(s => s.facultyId)
    });
    
    if (!isCreator && !isAssignedFaculty) {
      console.log('❌ Authorization failed: Not creator or assigned faculty');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this student'
      });
    }

    // Prepare allowed update fields
    const allowedFields = {
      name: updateData.name,
      mobile: updateData.mobile,
      parentContact: updateData.parentContact,
      address: updateData.address,
      dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
      emergencyContact: updateData.emergencyContact,
      section: updateData.section
    };

    // Remove undefined values
    Object.keys(allowedFields).forEach(key => {
      if (allowedFields[key] === undefined) {
        delete allowedFields[key];
      }
    });

    // Update student record
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        ...allowedFields,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('userId', 'name email mobile');

    // Update user record if name or mobile changed
    if (updateData.name || updateData.mobile) {
      const userUpdateData = {};
      if (updateData.name) userUpdateData.name = updateData.name;
      if (updateData.mobile) userUpdateData.mobile = updateData.mobile;
      
      await User.findByIdAndUpdate(student.userId, {
        ...userUpdateData,
        updatedAt: new Date()
      });
    }

    // Handle semester update if provided
    if (updateData.semester) {
      // Find the semester to update (current active semester or first one)
      const semesterToUpdate = student.semesters?.find(sem => sem.status === 'active') || student.semesters?.[0];
      
      if (semesterToUpdate) {
        // Update the semester name
        semesterToUpdate.semesterName = `Sem ${updateData.semester}`;
        semesterToUpdate.updatedAt = new Date();
        
        await Student.findByIdAndUpdate(id, {
          semesters: student.semesters,
          updatedAt: new Date()
        });
      }
    }

    console.log('✅ Student updated successfully:', {
      studentId: id,
      updatedFields: Object.keys(allowedFields),
      newName: updatedStudent.name || updatedStudent.userId?.name
    });

    res.json({
      success: true,
      message: 'Student information updated successfully',
      data: {
        id: updatedStudent._id,
        rollNumber: updatedStudent.rollNumber,
        name: updatedStudent.name || updatedStudent.userId?.name,
        email: updatedStudent.userId?.email,
        mobile: updatedStudent.mobile || updatedStudent.userId?.mobile,
        department: updatedStudent.department,
        batchYear: updatedStudent.batchYear,
        section: updatedStudent.section,
        updatedFields: Object.keys(allowedFields)
      }
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during student update'
    });
  }
});

// NOTE: This route has been removed to avoid conflict with the more comprehensive
// /:userId/semesters route below (line ~2022) which properly handles both student 
// and faculty authorization

// @desc    Verify student deletion (check if semesters array is cleared)
// @route   GET /api/students/:id/verify-deletion
// @access  Faculty and above
router.get('/:id/verify-deletion', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await Student.findById(id).select('rollNumber name status semesters deletedAt deletedBy');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        status: student.status,
        semestersCount: student.semesters?.length || 0,
        semesters: student.semesters || [],
        deletedAt: student.deletedAt,
        deletedBy: student.deletedBy,
        isDeleted: student.status === 'inactive',
        semestersCleared: (student.semesters?.length || 0) === 0
      }
    });
  } catch (error) {
    console.error('Verify deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying deletion'
    });
  }
});

// @desc    Verify route structure
// @route   GET /api/classes/verify/:classId
// @access  Faculty and above
router.get('/classes/verify/:classId', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUser = req.user;
    
    // Count students without fetching full data
    const studentCount = await Student.countDocuments({ 
      classAssigned: classId, 
      department: currentUser.department, 
      status: 'active' 
    });
    
    res.json({
      message: 'Route verification successful',
      classId,
      department: currentUser.department,
      studentCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Route verification failed',
      error: error.message
    });
  }
});

// @desc    Get students by class for class management
// @route   GET /api/classes/:classId/students
// @access  Faculty and above
router.get('/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUser = req.user;

    console.log(`Fetching students for class: ${classId}, department: ${currentUser.department}`);

    // Authorization: Faculty can only view students from their department that they created
    const students = await Student.find({ 
      classAssigned: classId, 
      department: currentUser.department, 
      createdBy: currentUser._id, // Only show students created by current faculty
      status: 'active' 
    })
    .select('rollNumber name department mobile semester year')
    .sort({ rollNumber: 1 });

    console.log(`Found ${students.length} students for class ${classId}`);

    // Transform to match expected response format
    const formattedStudents = students.map(student => ({
      id: student._id,
      rollNo: student.rollNumber,
      name: student.name,
      dept: student.department,
      mobile: student.mobile || 'N/A',
      semester: student.semester,
      year: student.year
    }));

    // Return response in the expected format with students array wrapped
    res.status(200).json({
      students: formattedStudents
    });
  } catch (error) {
    console.error('Get students by class error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      students: []
    });
  }
});

// @desc    Get student profile by ID
// @route   GET /api/students/:id
// @access  Faculty and above, or student accessing their own data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const student = await Student.findById(id)
      .select('rollNumber name department mobile semester year email classAssigned')
      .populate('facultyId', 'name');

    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Authorization: Faculty can view students from their department, students can view their own data
    if (currentUser.role === 'student') {
      if (currentUser._id.toString() !== student.userId.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only view your own profile'
        });
      }
    } else if (currentUser.role === 'faculty' && student.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Transform to match expected response format
    const studentProfile = {
      rollNo: student.rollNumber,
      name: student.name,
      dept: student.department,
      mobile: student.mobile || 'N/A',
      year: student.year,
      semester: student.semester,
      email: student.email,
      classAssigned: student.classAssigned,
      facultyName: student.facultyId?.name || 'N/A'
    };

    res.status(200).json(studentProfile);
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get detailed student profile with attendance data
// @route   GET /api/students/:id/profile
// @access  Faculty and above, or student accessing their own data
router.get('/:id/profile', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    console.log('🔍 Fetching profile for student ID:', id);
    console.log('👤 Current user:', currentUser.email, 'Role:', currentUser.role);

    const student = await Student.findById(id)
      .populate('userId', 'name email mobile status')
      .populate('facultyId', 'name email');

    if (!student) {
      console.log('❌ Student not found for ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('✅ Student found:', student.rollNumber, student.name);

    // Authorization: Faculty can view students from their department, students can view their own data
    if (currentUser.role === 'student') {
      if (currentUser._id.toString() !== student.userId._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own profile'
        });
      }
    } else if (currentUser.role === 'faculty' && student.department !== currentUser.department) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get attendance statistics
    console.log('📊 Fetching attendance stats...');
    const attendanceStats = await getAttendanceStats(student._id, student.department);
    console.log('📊 Attendance stats retrieved:', attendanceStats);

    // Format student object for frontend
    const studentData = {
      _id: student._id,
      id: student._id,
      rollNumber: student.rollNumber,
      name: student.name || student.userId?.name,
      email: student.email || student.userId?.email,
      mobile: student.mobile || student.userId?.mobile,
      parentContact: student.parentContact,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      department: student.department,
      batchYear: student.batchYear,
      section: student.section,
      semester: student.semester,
      year: student.year,
      classAssigned: student.classAssigned,
      status: student.status,
      facultyId: student.facultyId,
      semesters: student.semesters || [],
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    res.json({
      success: true,
      data: {
        student: studentData,
        attendanceStats
      }
    });

  } catch (error) {
    console.error('❌ Get student profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student profile'
    });
  }
});

// @desc    Get all enrolled semesters for a student
// @route   GET /api/students/:userId/semesters
// @access  Student (own data) or Faculty/Admin
router.get('/:userId/semesters', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    console.log('📚 Fetching semesters for user:', userId);

    // Find student by userId
    const student = await Student.findOne({ userId, status: 'active' })
      .populate('semesters.facultyId', 'name email')
      .populate('facultyId', 'name email')
      .select('semesters name rollNumber department batchYear section classId semester year classAssigned facultyId');

    console.log('🔍 Student found:', student ? 'Yes' : 'No');
    if (student) {
      console.log('📋 Student details:', {
        _id: student._id,
        userId: student.userId,
        name: student.name,
        rollNumber: student.rollNumber,
        department: student.department,
        batchYear: student.batchYear,
        section: student.section,
        semester: student.semester,
        year: student.year,
        classId: student.classId,
        classAssigned: student.classAssigned,
        facultyId: student.facultyId,
        semestersArrayLength: student.semesters?.length || 0,
        hasSemesters: !!(student.semesters && student.semesters.length > 0),
        hasOldStructure: !!(student.classId && student.semester)
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or inactive'
      });
    }

    // Authorization check
    if (currentUser.role === 'student' && currentUser._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Handle semesters array
    let semestersToProcess = [];
    
    if (student.semesters && student.semesters.length > 0) {
      // Use the semesters array (preferred method)
      console.log('✅ Using semesters array:', student.semesters.length, 'semesters');
      console.log('📋 Semesters:', student.semesters.map(s => ({
        name: s.semesterName,
        classId: s.classId,
        section: s.section
      })));
      semestersToProcess = student.semesters;
    } else if (student.classId && student.semester) {
      // FALLBACK: Create virtual semester from old structure (for legacy data only)
      console.warn('⚠️ Using fallback virtual semester from old structure - student should be migrated');
      const virtualSemester = {
        _id: student._id,
        semesterName: student.semester,
        year: student.year || '1st',
        section: student.section,
        classAssigned: student.classAssigned || student.section,
        classId: student.classId,
        department: student.department,
        batch: student.batchYear,
        status: 'active',
        facultyId: student.facultyId,
        createdAt: student.createdAt
      };
      semestersToProcess = [virtualSemester];
      console.log('📌 Virtual semester created (legacy fallback)');
    } else {
      console.error('❌ No semester data found!', {
        hasSemesters: !!(student.semesters && student.semesters.length > 0),
        hasClassId: !!student.classId,
        hasSemesterField: !!student.semester,
        studentData: {
          classId: student.classId,
          semester: student.semester,
          year: student.year,
          section: student.section,
          classAssigned: student.classAssigned
        }
      });
      return res.status(404).json({
        success: false,
        message: 'No semester data found for this student. Please contact faculty to assign you to a class.',
        debug: {
          hasSemestersArray: !!(student.semesters && student.semesters.length > 0),
          hasOldStructure: !!(student.classId && student.semester)
        }
      });
    }

    console.log('📊 Total semesters to process:', semestersToProcess.length);

    // Get attendance stats for each semester
    const semestersWithStats = await Promise.all(
      semestersToProcess.map(async (semester) => {
        // Count attendance for this semester's classId
        const attendanceCount = await Attendance.countDocuments({
          classId: semester.classId,
          'records.studentId': student._id
        });

        // Get attendance percentage for this semester
        const attendanceDocs = await Attendance.find({
          classId: semester.classId,
          'records.studentId': student._id
        });

        // Get holidays for this semester (both global and class-specific)
        const Holiday = (await import('../models/Holiday.js')).default;
        const holidays = await Holiday.find({
          $or: [
            // Global holidays for this department
            {
              department: semester.department,
              scope: 'global',
              isActive: true,
              isDeleted: false
            },
            // Class-specific holidays
            {
              department: semester.department,
              scope: 'class',
              batchYear: semester.batch,
              section: semester.section,
              semester: semester.semesterName,
              isActive: true,
              isDeleted: false
            }
          ]
        }).select('date');
        // Normalize holiday dates to YYYY-MM-DD strings
        const holidayDates = new Set(holidays.map(h => 
          typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0]
        ));

        let presentDays = 0;
        let totalDays = 0;

        attendanceDocs.forEach(doc => {
          const studentRecord = doc.records.find(r => r.studentId.toString() === student._id.toString());
          // Normalize attendance date for comparison
          const attendanceDateStr = typeof doc.date === 'string' ? doc.date : doc.date.toISOString().split('T')[0];
          if (studentRecord && !holidayDates.has(attendanceDateStr)) {
            totalDays++;
            if (studentRecord.status === 'present') {
              presentDays++;
            }
          }
        });

        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        return {
          _id: semester._id,
          semesterName: semester.semesterName,
          year: semester.year,
          section: semester.section,
          classAssigned: semester.classAssigned,
          classId: semester.classId,
          department: semester.department,
          batch: semester.batch,
          status: semester.status,
          faculty: semester.facultyId ? {
            name: semester.facultyId.name,
            email: semester.facultyId.email
          } : null,
          stats: {
            totalClasses: totalDays,
            presentDays,
            absentDays: totalDays - presentDays,
            attendancePercentage
          },
          createdAt: semester.createdAt
        };
      })
    );

    // Sort by semester name (Sem 1, Sem 2, etc.)
    semestersWithStats.sort((a, b) => {
      const semA = parseInt(a.semesterName.replace('Sem ', ''));
      const semB = parseInt(b.semesterName.replace('Sem ', ''));
      return semA - semB;
    });

    console.log(`✅ Found ${semestersWithStats.length} semesters for student`);

    const responseData = {
      success: true,
      data: {
        student: {
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department,
          batchYear: student.batchYear,
          section: student.section
        },
        semesters: semestersWithStats,
        total: semestersWithStats.length
      }
    };

    console.log('📤 Sending response:', JSON.stringify({
      success: responseData.success,
      studentName: responseData.data.student.name,
      semesterCount: responseData.data.semesters.length,
      semesters: responseData.data.semesters.map(s => ({
        name: s.semesterName,
        classId: s.classId,
        percentage: s.stats?.attendancePercentage
      }))
    }, null, 2));

    res.json(responseData);

  } catch (error) {
    console.error('❌ Get student semesters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student semesters'
    });
  }
});

// @desc    Get attendance details for a specific semester
// @route   GET /api/students/:userId/semesters/:semesterId/attendance
// @access  Student (own data) or Faculty/Admin
router.get('/:userId/semesters/:semesterId/attendance', authenticate, async (req, res) => {
  try {
    const { userId, semesterId } = req.params;
    const currentUser = req.user;

    console.log('📊 Fetching semester attendance:', { userId, semesterId });

    // Find student
    const student = await Student.findOne({ userId, status: 'active' });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Authorization check
    if (currentUser.role === 'student' && currentUser._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find the specific semester (handle backward compatibility)
    let semester = null;
    
    if (student.semesters && student.semesters.length > 0) {
      // Try to find in semesters array
      semester = student.semesters.id(semesterId);
    }
    
    // If not found in array, check if this is the student's own ID (virtual semester from old structure)
    if (!semester && semesterId === student._id.toString() && student.classId && student.semester) {
      console.log('📌 Using virtual semester from old structure');
      semester = {
        _id: student._id,
        semesterName: student.semester,
        year: student.year || '1st',
        section: student.section,
        classAssigned: student.classAssigned || student.section,
        classId: student.classId,
        department: student.department,
        batch: student.batchYear,
        status: 'active'
      };
    }

    if (!semester) {
      return res.status(404).json({
        success: false,
        message: 'Semester not found'
      });
    }

    // Get all attendance for this semester's classId
    const attendanceDocs = await Attendance.find({
      classId: semester.classId,
      'records.studentId': student._id
    }).sort({ date: -1 });

    // Get holidays (both global and class-specific)
    const Holiday = (await import('../models/Holiday.js')).default;
    const holidays = await Holiday.find({
      $or: [
        // Global holidays for this department
        {
          department: semester.department,
          scope: 'global',
          isActive: true,
          isDeleted: false
        },
        // Class-specific holidays
        {
          department: semester.department,
          scope: 'class',
          batchYear: semester.batch,
          section: semester.section,
          semester: semester.semesterName,
          isActive: true,
          isDeleted: false
        }
      ]
    }).select('date reason scope');
    
    console.log(`🎉 Found ${holidays.length} holidays for semester:`, {
      department: semester.department,
      batch: semester.batch,
      section: semester.section,
      semester: semester.semesterName,
      holidayDates: holidays.map(h => h.date)
    });
    
    // Create holiday map with normalized date strings (YYYY-MM-DD)
    const holidayMap = new Map(holidays.map(h => {
      const normalizedDate = typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0];
      return [normalizedDate, h.reason];
    }));

    // Extract student's attendance records
    const attendanceRecords = [];
    const attendanceDatesSet = new Set(); // Track which dates have attendance records
    let presentDays = 0;
    let absentDays = 0;
    let holidayDays = 0;

    // Process attendance records
    attendanceDocs.forEach(doc => {
      const studentRecord = doc.records.find(r => r.studentId.toString() === student._id.toString());
      if (studentRecord) {
        // Normalize attendance date to YYYY-MM-DD string for comparison
        const attendanceDateStr = typeof doc.date === 'string' ? doc.date : doc.date.toISOString().split('T')[0];
        attendanceDatesSet.add(attendanceDateStr);
        const isHoliday = holidayMap.has(attendanceDateStr);
        
        const record = {
          date: doc.date,
          status: isHoliday ? 'Holiday' : (studentRecord.status === 'present' ? 'Present' : 'Absent'),
          reason: studentRecord.reason || null,
          reviewStatus: studentRecord.reviewStatus || 'Not Applicable',
          facultyNote: studentRecord.facultyNote || null,
          reasonSubmittedAt: studentRecord.reasonSubmittedAt || null,
          holidayReason: isHoliday ? holidayMap.get(attendanceDateStr) : null
        };

        attendanceRecords.push(record);

        if (isHoliday) {
          holidayDays++;
        } else if (studentRecord.status === 'present') {
          presentDays++;
        } else {
          absentDays++;
        }
      }
    });

    // Add holidays that don't have attendance records
    holidays.forEach(holiday => {
      const normalizedDate = typeof holiday.date === 'string' ? holiday.date : holiday.date.toISOString().split('T')[0];
      
      // If this holiday date doesn't have an attendance record, add it
      if (!attendanceDatesSet.has(normalizedDate)) {
        attendanceRecords.push({
          date: normalizedDate,
          status: 'Holiday',
          reason: null,
          reviewStatus: 'Not Applicable',
          facultyNote: null,
          reasonSubmittedAt: null,
          holidayReason: holiday.reason
        });
        holidayDays++;
      }
    });

    // Sort attendance records by date (newest first)
    attendanceRecords.sort((a, b) => {
      const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
      const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
      return dateB - dateA;
    });

    const totalWorkingDays = presentDays + absentDays;
    const attendancePercentage = totalWorkingDays > 0 
      ? Math.round((presentDays / totalWorkingDays) * 100) 
      : 0;

    console.log(`📊 Final stats:`, {
      totalRecords: attendanceRecords.length,
      presentDays,
      absentDays,
      holidayDays,
      totalWorkingDays,
      attendancePercentage
    });

    res.json({
      success: true,
      data: {
        semester: {
          _id: semester._id,
          semesterName: semester.semesterName,
          year: semester.year,
          section: semester.section,
          classAssigned: semester.classAssigned,
          classId: semester.classId,
          department: semester.department,
          batch: semester.batch
        },
        student: {
          name: student.name,
          rollNumber: student.rollNumber,
          department: student.department
        },
        stats: {
          totalWorkingDays,
          presentDays,
          absentDays,
          holidayDays,
          attendancePercentage
        },
        attendance: attendanceRecords
      }
    });

  } catch (error) {
    console.error('❌ Get semester attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch semester attendance'
    });
  }
});

// Helper function to get attendance statistics
async function getAttendanceStats(studentId, department) {
  try {
    console.log('📊 Getting attendance stats for student:', studentId, 'department:', department);
    
    // Get the student to find their classId and info
    const student = await Student.findById(studentId);
    if (!student) {
      console.log('❌ Student not found');
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        attendancePercentage: 0,
        recentAttendance: []
      };
    }

    console.log('👤 Student:', student.rollNumber, student.name);
    
    // Find all attendance documents for the student's department
    // The student's attendance is stored in the records array of class-level attendance documents
    const attendanceDocs = await Attendance.find({
      department: department,
      'records.studentId': studentId
    }).sort({ date: -1 });

    console.log(`📚 Found ${attendanceDocs.length} attendance documents`);

    if (!attendanceDocs || attendanceDocs.length === 0) {
      console.log('❌ No attendance records found');
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        attendancePercentage: 0,
        recentAttendance: []
      };
    }

    // Get holidays for this department to exclude from percentage
    const Holiday = (await import('../models/Holiday.js')).default;
    const holidays = await Holiday.find({
      department: department,
      isActive: true,
      isDeleted: false
    }).select('date');

    // Normalize holiday dates to YYYY-MM-DD strings
    const holidayDates = new Set(holidays.map(h => 
      typeof h.date === 'string' ? h.date : h.date.toISOString().split('T')[0]
    ));
    console.log(`🎉 Found ${holidayDates.size} holidays for department`);

    // Extract this student's attendance from each document's records array
    const studentAttendance = [];
    attendanceDocs.forEach(doc => {
      const studentRecord = doc.records.find(r => r.studentId.toString() === studentId.toString());
      if (studentRecord) {
        // Normalize attendance date for comparison
        const attendanceDateStr = typeof doc.date === 'string' ? doc.date : doc.date.toISOString().split('T')[0];
        const isHoliday = holidayDates.has(attendanceDateStr);
        studentAttendance.push({
          date: doc.date,
          status: isHoliday ? 'Holiday' : (studentRecord.status === 'present' ? 'Present' : 'Absent'),
          reason: studentRecord.reason || null,
          reviewStatus: studentRecord.reviewStatus || 'Not Applicable',
          facultyNote: studentRecord.facultyNote || null,
          reasonSubmittedAt: studentRecord.reasonSubmittedAt || null
        });
      }
    });

    console.log(`📊 Extracted ${studentAttendance.length} attendance records for student`);

    // Calculate stats excluding holidays
    const workingDays = studentAttendance.filter(record => record.status !== 'Holiday');
    const totalDays = workingDays.length;
    const presentDays = workingDays.filter(record => record.status === 'Present').length;
    const absentDays = workingDays.filter(record => record.status === 'Absent').length;
    const holidayDays = studentAttendance.filter(record => record.status === 'Holiday').length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    console.log(`📈 Stats: Total=${totalDays}, Present=${presentDays}, Absent=${absentDays}, Holidays=${holidayDays}, Percentage=${attendancePercentage}%`);

    // Get recent attendance (last 10 records)
    const recentAttendance = studentAttendance.slice(0, 10);

    // Count pending and reviewed reasons
    const pendingReasons = studentAttendance.filter(r => r.reviewStatus === 'Pending').length;
    const reviewedReasons = studentAttendance.filter(r => r.reviewStatus === 'Reviewed').length;

    return {
      totalDays,
      presentDays,
      absentDays,
      holidayDays,
      attendancePercentage,
      recentAttendance,
      reasonStats: {
        pendingReasons,
        reviewedReasons,
        totalSubmitted: pendingReasons + reviewedReasons
      }
    };
  } catch (error) {
    console.error('❌ Error getting attendance stats:', error);
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      attendancePercentage: 0,
      recentAttendance: []
    };
  }
}

// @desc    Get student attendance history with pagination
// @route   GET /api/students/:id/attendance
// @access  Faculty and above, or student accessing their own data
router.get('/:id/attendance', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        status: 'error',
        message: 'Student not found'
      });
    }

    // Authorization: Faculty can view students from their department, students can view their own data
    if (currentUser.role === 'student') {
      if (currentUser._id.toString() !== student.userId.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only view your own attendance'
        });
      }
    } else if (currentUser.role === 'faculty' && student.department !== currentUser.department) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Get all attendance records for statistics
    const allAttendanceRecords = await Attendance.find({ 
      studentId: student.userId 
    })
    .select('date status reason')
    .sort({ date: -1 });

    if (allAttendanceRecords.length === 0) {
      return res.status(200).json({
        presentDays: 0,
        absentDays: 0,
        totalWorkingDays: 0,
        attendancePercentage: 0,
        attendanceHistory: [],
        semesterAbsents: 0,
        pagination: {
          current: page,
          pages: 0,
          total: 0,
          limit
        },
        message: 'No attendance records found'
      });
    }

    // Calculate statistics
    const presentDays = allAttendanceRecords.filter(record => record.status === 'Present').length;
    const absentDays = allAttendanceRecords.filter(record => record.status === 'Absent').length;
    const totalWorkingDays = presentDays + absentDays;
    const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    // Get current semester absents (last 30 days as approximation)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const semesterAbsents = allAttendanceRecords.filter(record => 
      record.status === 'Absent' && record.date >= thirtyDaysAgo
    ).length;

    // Paginate attendance history
    const skip = (page - 1) * limit;
    const paginatedRecords = await Attendance.find({ 
      studentId: student.userId 
    })
    .select('date status reason')
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

    // Format attendance history with reasons
    const attendanceHistory = paginatedRecords.map(record => ({
      id: record._id,
      date: record.date.toISOString().split('T')[0],
      status: record.status,
      reason: record.reason || '',
      canEdit: currentUser.role !== 'student' && record.status === 'Absent' // Faculty can edit absent reasons
    }));

    const totalPages = Math.ceil(allAttendanceRecords.length / limit);

    res.status(200).json({
      presentDays,
      absentDays,
      totalWorkingDays,
      attendancePercentage,
      attendanceHistory,
      semesterAbsents,
      pagination: {
        current: page,
        pages: totalPages,
        total: allAttendanceRecords.length,
        limit
      }
    });
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});


// @desc    Update student information (Faculty only)
// @route   PUT /api/faculty/student/:id/update
// @access  Faculty and above
router.put('/faculty/student/:id/update', authenticate, facultyAndAbove, [
  body('name').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Mobile number must be exactly 10 digits'),
  body('parentContact').optional().matches(/^[0-9]{10}$/).withMessage('Parent contact must be exactly 10 digits'),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('department').optional().isIn(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']).withMessage('Invalid department'),
  body('section').optional().isIn(['A', 'B']).withMessage('Section must be A or B'),
  body('semester').optional().isIn(['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']).withMessage('Invalid semester')
], async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().reduce((acc, error) => {
          acc[error.path] = error.msg;
          return acc;
        }, {})
      });
    }

    console.log('📝 Faculty update student request:', {
      studentId: id,
      facultyId: currentUser._id,
      facultyRole: currentUser.role,
      facultyDepartment: currentUser.department,
      updateData: req.body
    });

    // Find the student
    const student = await Student.findById(id);
    if (!student) {
      console.log('❌ Student not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if faculty has access to update this student
    const isCreator = student.createdBy && student.createdBy.toString() === currentUser._id.toString();
    const isAssignedFaculty = student.semesters && student.semesters.some(sem => 
      sem.facultyId && sem.facultyId.toString() === currentUser._id.toString()
    );
    const hasDepartmentAccess = student.department === currentUser.department;
    
    console.log('🔐 Update authorization check:', {
      isCreator,
      isAssignedFaculty,
      hasDepartmentAccess,
      studentDepartment: student.department,
      facultyDepartment: currentUser.department
    });
    
    if (!isCreator && !isAssignedFaculty && !hasDepartmentAccess) {
      console.log('❌ Update access denied: Faculty not authorized');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this student'
      });
    }

    // Prepare update data (only allow specific fields to be updated)
    const allowedFields = ['name', 'mobile', 'parentContact', 'address', 'dateOfBirth', 'department', 'section', 'semester'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Add timestamp
    updateData.updatedAt = new Date();
    updateData.updatedBy = currentUser._id;

    console.log('📝 Updating student with data:', updateData);

    // Update the student
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'email status');

    if (!updatedStudent) {
      console.log('❌ Failed to update student');
      return res.status(500).json({
        success: false,
        message: 'Failed to update student'
      });
    }

    console.log('✅ Student updated successfully:', {
      studentId: updatedStudent._id,
      name: updatedStudent.name,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Student information updated successfully',
      data: {
        id: updatedStudent._id,
        name: updatedStudent.name,
        rollNumber: updatedStudent.rollNumber,
        email: updatedStudent.email,
        department: updatedStudent.department,
        updatedFields: Object.keys(updateData)
      }
    });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating student'
    });
  }
});

export default router;

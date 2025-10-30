/**
 * Unified Student Service
 * Handles 8-semester student continuity with proper validation and data integrity
 */

import Student from '../models/Student.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import mongoose from 'mongoose';

/**
 * Safely convert value to string and trim
 */
function safeStringTrim(value, defaultValue = '') {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value).trim();
}

/**
 * Validate student data before processing
 */
export function validateStudentData(studentData, classContext) {
  const errors = [];
  
  // Required fields validation
  if (!studentData.name || safeStringTrim(studentData.name).length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!studentData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeStringTrim(studentData.email))) {
    errors.push('Valid email address is required');
  }
  
  if (!studentData.rollNumber || safeStringTrim(studentData.rollNumber).length === 0) {
    errors.push('Roll number is required');
  }
  
  if (!classContext.batchYear) {
    errors.push('Batch year is required');
  }
  
  if (!classContext.section) {
    errors.push('Section is required');
  }
  
  if (!classContext.department) {
    errors.push('Department is required');
  }
  
  if (!classContext.semesterName) {
    errors.push('Semester is required');
  }
  
  if (!classContext.year) {
    errors.push('Year is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check for existing students and determine action based on batch/section/department matching
 */
export async function checkExistingStudent(studentData, classContext) {
  try {
    // Search for existing student by email or roll number
    const existingStudent = await Student.findOne({
      $or: [
        { email: safeStringTrim(studentData.email).toLowerCase() },
        { rollNumber: safeStringTrim(studentData.rollNumber) }
      ]
    });
    
    if (existingStudent) {
      // Check if batch, section, and department match
      if (existingStudent.batchYear === classContext.batchYear && 
          existingStudent.section === classContext.section &&
          existingStudent.department === classContext.department) {
        
        // Check if already enrolled in this semester
        const semesterExists = existingStudent.semesters.some(sem => 
          sem.semesterName === classContext.semesterName &&
          sem.year === classContext.year &&
          sem.facultyId.toString() === classContext.facultyId.toString()
        );
        
        if (semesterExists) {
          return {
            action: 'duplicate',
            reason: 'Student already enrolled in this semester',
            existingStudent: null
          };
        } else {
          return {
            action: 'update',
            reason: 'Student exists - will add new semester',
            existingStudent
          };
        }
      } else {
        // Student exists in different batch/section/department
        return {
          action: 'reject',
          reason: 'Student already exists in another batch, section, or department',
          existingStudent: null,
          conflictDetails: {
            existingBatch: existingStudent.batchYear,
            existingSection: existingStudent.section,
            existingDepartment: existingStudent.department,
            requestedBatch: classContext.batchYear,
            requestedSection: classContext.section,
            requestedDepartment: classContext.department
          }
        };
      }
    }
    
    return {
      action: 'create',
      reason: 'New student - will create new record',
      existingStudent: null
    };
    
  } catch (error) {
    console.error('Error checking existing student:', error);
    return {
      action: 'error',
      reason: 'Error checking existing student',
      existingStudent: null,
      error
    };
  }
}

/**
 * Create unified student record format
 */
export function createUnifiedStudentFormat(studentData, classContext, facultyId, createdBy) {
  return {
    name: safeStringTrim(studentData.name),
    email: safeStringTrim(studentData.email).toLowerCase(),
    rollNumber: safeStringTrim(studentData.rollNumber),
    department: classContext.department,
    batchYear: classContext.batchYear,
    section: classContext.section,
    mobile: safeStringTrim(studentData.mobile),
    parentContact: safeStringTrim(studentData.parentContact),
    address: safeStringTrim(studentData.address),
    dateOfBirth: studentData.dateOfBirth || null,
    emergencyContact: studentData.emergencyContact || null,
    semesters: [createSemesterEntry(studentData, classContext, facultyId, createdBy)],
    status: 'active',
    createdBy: createdBy
  };
}

/**
 * Create semester entry for unified format
 */
export function createSemesterEntry(studentData, classContext, facultyId, createdBy) {
  // Generate class assignment based on year and section
  const yearNumber = classContext.year.replace(' Year', '').replace('st', '').replace('nd', '').replace('rd', '').replace('th', '');
  const classAssigned = `${yearNumber}${classContext.section}`;
  
  // Generate classId for this semester enrollment
  const classId = `${classContext.batchYear}_${classContext.year}_${classContext.semesterName}_${classContext.section}`;
  
  return {
    semesterName: classContext.semesterName,
    year: classContext.year,
    section: classContext.section,
    batch: classContext.batchYear,
    department: classContext.department,
    facultyId: facultyId,
    classAssigned: classAssigned,
    classId: classId,
    status: 'active',
    createdBy: createdBy
  };
}

/**
 * Create or update student using unified format
 */
export async function createOrUpdateStudent(studentData, classContext, facultyId, createdBy) {
  try {
    // Validate input data
    const validation = validateStudentData(studentData, classContext);
    if (!validation.isValid) {
      return {
        success: false,
        action: 'validation_error',
        message: 'Validation failed',
        errors: validation.errors
      };
    }
    
    // Check for existing student
    const existingCheck = await checkExistingStudent(studentData, classContext);
    
    if (existingCheck.action === 'error') {
      return {
        success: false,
        action: 'error',
        message: 'Error checking existing student',
        error: existingCheck.error
      };
    }
    
    if (existingCheck.action === 'reject') {
      return {
        success: false,
        action: 'reject',
        message: existingCheck.reason,
        conflictDetails: existingCheck.conflictDetails
      };
    }
    
    if (existingCheck.action === 'duplicate') {
      return {
        success: false,
        action: 'duplicate',
        message: existingCheck.reason
      };
    }
    
    // Handle User record creation/retrieval
    let user;
    if (existingCheck.action === 'create') {
      // Check if user already exists by email
      const existingUser = await User.findOne({
        email: safeStringTrim(studentData.email).toLowerCase()
      });
      
      if (existingUser) {
        user = existingUser;
      } else {
        // Create new user
        user = new User({
          name: safeStringTrim(studentData.name),
          email: safeStringTrim(studentData.email).toLowerCase(),
          password: studentData.password || 'defaultPassword123',
          role: 'student',
          department: classContext.department,
          class: `${classContext.year} ${classContext.section}`,
          mobile: safeStringTrim(studentData.mobile),
          createdBy: createdBy,
          status: 'active'
        });
        
        await user.save();
      }
    } else {
      // Get existing user from existing student
      user = await User.findById(existingCheck.existingStudent.userId);
    }
    
    if (existingCheck.action === 'create') {
      // Create new student record
      const studentFormat = createUnifiedStudentFormat(studentData, classContext, facultyId, createdBy);
      const student = new Student({
        ...studentFormat,
        userId: user._id
      });
      
      await student.save();
      
      return {
        success: true,
        action: 'created',
        message: 'Student created successfully',
        student: student
      };
      
    } else if (existingCheck.action === 'update') {
      // Add semester to existing student
      const newSemester = createSemesterEntry(studentData, classContext, facultyId, createdBy);
      
      const updatedStudent = await Student.findByIdAndUpdate(
        existingCheck.existingStudent._id,
        { $push: { semesters: newSemester } },
        { new: true }
      );
      
      return {
        success: true,
        action: 'updated',
        message: 'Student semester added successfully',
        student: updatedStudent
      };
    }
    
  } catch (error) {
    console.error('Error creating/updating student:', error);
    return {
      success: false,
      action: 'error',
      message: 'Error processing student',
      error: error
    };
  }
}

/**
 * Bulk create or update students
 */
export async function bulkCreateOrUpdateStudents(studentsData, classContext, facultyId, createdBy) {
  const results = {
    successful: [],
    skipped: [],
    failed: [],
    summary: {
      total: studentsData.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    }
  };
  
  for (let i = 0; i < studentsData.length; i++) {
    const studentData = studentsData[i];
    const result = await createOrUpdateStudent(studentData, classContext, facultyId, createdBy);
    
    if (result.success) {
      if (result.action === 'created') {
        results.successful.push({
          index: i,
          student: result.student,
          message: result.message
        });
        results.summary.created++;
      } else if (result.action === 'updated') {
        results.successful.push({
          index: i,
          student: result.student,
          message: result.message
        });
        results.summary.updated++;
      }
    } else {
      if (result.action === 'duplicate') {
        results.skipped.push({
          index: i,
          studentData: studentData,
          message: result.message
        });
        results.summary.skipped++;
      } else {
        results.failed.push({
          index: i,
          studentData: studentData,
          error: result.message,
          details: result.conflictDetails || null
        });
        results.summary.failed++;
      }
    }
  }
  
  return results;
}

/**
 * Retrieve students for faculty dashboard using unified format
 */
export async function getStudentsForFaculty(facultyId, classContext) {
  try {
    console.log('🔍 [SERVICE] getStudentsForFaculty called');
    console.log('   Faculty ID:', facultyId);
    console.log('   Class context:', JSON.stringify(classContext, null, 2));

    // Build base query - only include section if it's provided
    let baseQuery = {
      department: classContext.department,
      batchYear: classContext.batchYear,
      'semesters.semesterName': classContext.semesterName,
      'semesters.year': classContext.year,
      'semesters.status': 'active',
      status: 'active'
    };

    // Only add section filter if section is provided and not null
    if (classContext.section) {
      baseQuery.section = classContext.section;
      console.log('🔍 [SERVICE] Section filter added:', classContext.section);
    } else {
      console.log('🔍 [SERVICE] No section specified - searching ALL sections');
    }

    // TIER 1: Try with facultyId first (for assigned faculty)
    const tier1Query = {
      ...baseQuery,
      'semesters.facultyId': new mongoose.Types.ObjectId(facultyId)
    };

    console.log('🔍 [SERVICE] TIER 1 Query (with facultyId):', JSON.stringify(tier1Query, null, 2));

    let students = await Student.find(tier1Query)
      .select('userId rollNumber name email mobile parentContact address dateOfBirth emergencyContact semesters createdBy createdAt batchYear section department')
      .populate('userId', 'name email mobile')
      .sort({ rollNumber: 1 });

    console.log(`📊 [SERVICE] TIER 1: Found ${students.length} students with facultyId match`);

    // TIER 2: If no students found, try without facultyId (for HODs/admins or different class advisors viewing)
    if (students.length === 0) {
      console.log('🔍 [SERVICE] TIER 2: Trying broader query WITHOUT facultyId...');
      
      console.log('🔍 [SERVICE] TIER 2 Query:', JSON.stringify(baseQuery, null, 2));

      students = await Student.find(baseQuery)
        .select('userId rollNumber name email mobile parentContact address dateOfBirth emergencyContact semesters createdBy createdAt batchYear section department')
        .populate('userId', 'name email mobile')
        .sort({ rollNumber: 1 });

      console.log(`📊 [SERVICE] TIER 2: Found ${students.length} students without facultyId restriction`);
    }

    console.log(`📊 [SERVICE] FINAL: ${students.length} students found`);

    if (students.length > 0) {
      console.log(`📋 [SERVICE] Sample student:`, {
        name: students[0].name,
        rollNumber: students[0].rollNumber,
        section: students[0].section,
        batchYear: students[0].batchYear,
        semestersCount: students[0].semesters?.length || 0
      });
    }

    // Transform to include semester-specific data
    const formattedStudents = students.map(student => {
      // Try to find semester - first with facultyId match, then without
      let currentSemester = student.semesters.find(sem => 
        sem.semesterName === classContext.semesterName &&
        sem.year === classContext.year &&
        sem.facultyId.toString() === facultyId.toString() &&
        (classContext.section ? sem.section === classContext.section : true)
      );

      // If not found with facultyId, try without (for HODs/admins)
      if (!currentSemester) {
        currentSemester = student.semesters.find(sem => 
          sem.semesterName === classContext.semesterName &&
          sem.year === classContext.year &&
          (classContext.section ? sem.section === classContext.section : true)
        );
      }

      return {
        id: student._id,
        _id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        mobile: student.mobile || 'N/A',
        parentContact: student.parentContact || 'N/A',
        address: student.address || '',
        dateOfBirth: student.dateOfBirth,
        emergencyContact: student.emergencyContact,
        batchYear: student.batchYear,
        department: student.department,
        section: student.section,
        currentSemester: currentSemester,
        userId: student.userId,
        createdBy: student.createdBy,
        createdAt: student.createdAt
      };
    });

    console.log(`✅ [SERVICE] Returning ${formattedStudents.length} formatted students`);

    return {
      success: true,
      students: formattedStudents,
      total: formattedStudents.length
    };

  } catch (error) {
    console.error('❌ [SERVICE] Error getting students for faculty:', error);
    return {
      success: false,
      error: error,
      students: [],
      total: 0
    };
  }
}

/**
 * Get student's complete academic history across all semesters
 */
export async function getStudentAcademicHistory(studentId) {
  try {
    const student = await Student.findById(studentId)
      .select('rollNumber name email department batchYear section semesters')
      .populate('semesters.facultyId', 'name');

    if (!student) {
      return {
        success: false,
        error: 'Student not found'
      };
    }

    // Sort semesters by year and semester number
    const sortedSemesters = student.semesters.sort((a, b) => {
      const yearOrder = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 };
      const semesterOrder = { 'Sem 1': 1, 'Sem 2': 2, 'Sem 3': 3, 'Sem 4': 4, 'Sem 5': 5, 'Sem 6': 6, 'Sem 7': 7, 'Sem 8': 8 };
      
      if (yearOrder[a.year] !== yearOrder[b.year]) {
        return yearOrder[a.year] - yearOrder[b.year];
      }
      return semesterOrder[a.semesterName] - semesterOrder[b.semesterName];
    });

    return {
      success: true,
      student: {
        id: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        department: student.department,
        batchYear: student.batchYear,
        section: student.section,
        academicHistory: sortedSemesters
      }
    };

  } catch (error) {
    console.error('Error getting student academic history:', error);
    return {
      success: false,
      error: error
    };
  }
}

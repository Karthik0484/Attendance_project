/**
 * Multi-Semester Student Management Service
 * 
 * Handles student creation and management across multiple semesters
 * without duplication errors by maintaining a single student profile
 * with semester enrollment linkages.
 */

import mongoose from 'mongoose';
import Student from '../models/Student.js';
import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import { normalizeClassId } from '../utils/classIdNormalizer.js';

/**
 * Create or update student for a specific semester
 * @param {Object} options - Creation options
 * @param {Object} options.currentUser - Authenticated user (faculty)
 * @param {Object} options.studentData - Student data from form or file
 * @param {Object} options.semesterContext - Semester context (batch, year, semester, section, facultyId)
 * @returns {Object} - { success, student, user, error, isNewStudent }
 */
export async function createOrUpdateStudentForSemester(options) {
  const { currentUser, studentData, semesterContext } = options;
  
  try {
    console.log('🔧 Creating/updating student for semester:', {
      studentName: studentData.name,
      facultyId: currentUser._id,
      semesterContext
    });

    // Step 1: Validate faculty authorization
    const faculty = await validateFacultyAuthorization(currentUser, semesterContext);
    if (!faculty.success) {
      console.error('❌ Faculty authorization failed:', faculty.error);
      return { success: false, error: faculty.error };
    }

    // Step 2: Validate student data
    const validation = validateStudentData(studentData);
    if (!validation.success) {
      console.error('❌ Student data validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    // Step 3: Check if student exists globally
    const existingStudent = await findExistingStudent(studentData, semesterContext.batch);
    
    if (existingStudent) {
      console.log('👤 Found existing student, checking semester enrollment');
      
      // Check if student is already enrolled in this semester
      const isEnrolledInSemester = checkSemesterEnrollment(existingStudent, semesterContext);
      
      if (isEnrolledInSemester) {
        console.log('⚠️ Student already enrolled in this semester, skipping');
        return {
          success: true,
          student: existingStudent,
          user: await User.findById(existingStudent.userId),
          isNewStudent: false,
          message: 'Student already enrolled in this semester'
        };
      }

      // Add new semester enrollment to existing student
      const updatedStudent = await addSemesterEnrollment(existingStudent, semesterContext, currentUser);
      return {
        success: true,
        student: updatedStudent,
        user: await User.findById(updatedStudent.userId),
        isNewStudent: false,
        message: 'Added new semester enrollment to existing student'
      };
    } else {
      console.log('👤 Creating new student with semester enrollment');
      
      // Create new student with semester enrollment
      const result = await createNewStudentWithSemester(studentData, semesterContext, currentUser);
      return {
        success: true,
        student: result.student,
        user: result.user,
        isNewStudent: true,
        message: 'Created new student with semester enrollment'
      };
    }

  } catch (error) {
    console.error('❌ Error in createOrUpdateStudentForSemester:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find existing student by email or roll number within batch
 */
async function findExistingStudent(studentData, batch) {
  try {
    const student = await Student.findOne({
      $and: [
        { batch: batch },
        {
          $or: [
            { email: studentData.email },
            { rollNumber: studentData.rollNumber }
          ]
        }
      ]
    });

    return student;
  } catch (error) {
    console.error('Error finding existing student:', error);
    return null;
  }
}

/**
 * Check if student is already enrolled in the current semester
 */
function checkSemesterEnrollment(student, semesterContext) {
  if (!student.semesters || student.semesters.length === 0) {
    return false;
  }

  return student.semesters.some(semester => 
    semester.semesterName === semesterContext.semesterName &&
    semester.year === semesterContext.year &&
    semester.section === semesterContext.section &&
    semester.facultyId.toString() === semesterContext.facultyId.toString()
  );
}

/**
 * Add new semester enrollment to existing student
 */
async function addSemesterEnrollment(student, semesterContext, currentUser) {
  try {
    const semesterEnrollment = {
      semesterName: semesterContext.semesterName,
      year: semesterContext.year,
      section: semesterContext.section,
      classAssigned: semesterContext.classAssigned,
      facultyId: semesterContext.facultyId,
      department: semesterContext.department,
      batch: semesterContext.batch,
      status: 'active',
      classId: `${semesterContext.batch}_${semesterContext.year}_${semesterContext.semesterName}_${semesterContext.section}`
    };

    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      {
        $push: { semesters: semesterEnrollment }
      },
      { new: true }
    );

    console.log('✅ Added semester enrollment to existing student');
    return updatedStudent;
  } catch (error) {
    console.error('Error adding semester enrollment:', error);
    throw error;
  }
}

/**
 * Create new student with semester enrollment
 */
async function createNewStudentWithSemester(studentData, semesterContext, currentUser) {
  try {
    // Create User record
    const user = new User({
      name: studentData.name,
      email: studentData.email,
      password: studentData.password || 'defaultPassword123', // Should be hashed
      role: 'student',
      department: semesterContext.department,
      batch: semesterContext.batch
    });

    await user.save();

    // Create semester enrollment
    const semesterEnrollment = {
      semesterName: semesterContext.semesterName,
      year: semesterContext.year,
      section: semesterContext.section,
      classAssigned: semesterContext.classAssigned,
      facultyId: semesterContext.facultyId,
      department: semesterContext.department,
      batch: semesterContext.batch,
      status: 'active',
      classId: `${semesterContext.batch}_${semesterContext.year}_${semesterContext.semesterName}_${semesterContext.section}`
    };

    // Create Student record
    const student = new Student({
      userId: user._id,
      rollNumber: studentData.rollNumber,
      name: studentData.name,
      email: studentData.email,
      department: semesterContext.department,
      batch: semesterContext.batch,
      semesters: [semesterEnrollment],
      mobile: studentData.mobile,
      parentContact: studentData.parentContact,
      address: studentData.address,
      dateOfBirth: studentData.dateOfBirth,
      emergencyContact: studentData.emergencyContact,
      createdBy: currentUser._id,
      status: 'active'
    });

    await student.save();

    console.log('✅ Created new student with semester enrollment');
    return { student, user };
  } catch (error) {
    console.error('Error creating new student:', error);
    throw error;
  }
}

/**
 * Get students for a specific semester/class
 */
export async function getStudentsForSemester(semesterContext) {
  try {
    console.log('🔍 Fetching students for semester:', semesterContext);

    const students = await Student.find({
      'semesters.semesterName': semesterContext.semesterName,
      'semesters.batch': semesterContext.batch,
      'semesters.section': semesterContext.section,
      'semesters.facultyId': semesterContext.facultyId,
      'semesters.status': 'active',
      status: 'active'
    }).populate('userId', 'name email role');

    console.log(`✅ Found ${students.length} students for semester`);
    return {
      success: true,
      students: students
    };
  } catch (error) {
    console.error('Error fetching students for semester:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update student information (global update)
 */
export async function updateStudentInfo(studentId, updateData) {
  try {
    console.log('🔄 Updating student info:', studentId);

    // Remove semester-specific fields from update data
    const { semesters, ...globalUpdateData } = updateData;

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: globalUpdateData },
      { new: true }
    );

    if (!updatedStudent) {
      return {
        success: false,
        error: 'Student not found'
      };
    }

    console.log('✅ Student info updated successfully');
    return {
      success: true,
      student: updatedStudent
    };
  } catch (error) {
    console.error('Error updating student info:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update semester enrollment status
 */
export async function updateSemesterStatus(studentId, semesterContext, status) {
  try {
    console.log('🔄 Updating semester status:', { studentId, semesterContext, status });

    const updatedStudent = await Student.findOneAndUpdate(
      {
        _id: studentId,
        'semesters.semesterName': semesterContext.semesterName,
        'semesters.year': semesterContext.year,
        'semesters.section': semesterContext.section,
        'semesters.facultyId': semesterContext.facultyId
      },
      {
        $set: {
          'semesters.$.status': status,
          'semesters.$.updatedAt': new Date()
        }
      },
      { new: true }
    );

    if (!updatedStudent) {
      return {
        success: false,
        error: 'Student or semester enrollment not found'
      };
    }

    console.log('✅ Semester status updated successfully');
    return {
      success: true,
      student: updatedStudent
    };
  } catch (error) {
    console.error('Error updating semester status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate faculty authorization
 */
async function validateFacultyAuthorization(currentUser, semesterContext) {
  try {
    const faculty = await Faculty.findOne({
      userId: currentUser._id,
      status: 'active'
    });

    if (!faculty) {
      return {
        success: false,
        error: 'Faculty not found or inactive'
      };
    }

    // Check if faculty is assigned to this class
    const isAssigned = faculty.assignedClasses && 
      faculty.assignedClasses.some(assignment => 
        assignment.classId === `${semesterContext.batch}_${semesterContext.year}_${semesterContext.semesterName}_${semesterContext.section}`
      );

    if (!isAssigned) {
      return {
        success: false,
        error: 'Faculty not assigned to this class'
      };
    }

    return {
      success: true,
      data: faculty
    };
  } catch (error) {
    console.error('Error validating faculty authorization:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate student data
 */
function validateStudentData(studentData) {
  const requiredFields = ['name', 'email', 'rollNumber', 'mobile', 'parentContact'];
  
  for (const field of requiredFields) {
    if (!studentData[field]) {
      return {
        success: false,
        error: `${field} is required`
      };
    }
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(studentData.email)) {
    return {
      success: false,
      error: 'Invalid email format'
    };
  }

  // Validate mobile number
  const mobileRegex = /^[0-9]{10}$/;
  if (!mobileRegex.test(studentData.mobile)) {
    return {
      success: false,
      error: 'Mobile number must be exactly 10 digits'
    };
  }

  if (!mobileRegex.test(studentData.parentContact)) {
    return {
      success: false,
      error: 'Parent contact must be exactly 10 digits'
    };
  }

  return {
    success: true
  };
}

/**
 * Bulk create or update students for a semester
 */
export async function bulkCreateOrUpdateStudentsForSemester(studentsData, semesterContext, currentUser) {
  try {
    console.log(`🔄 Bulk processing ${studentsData.length} students for semester`);

    const results = {
      success: [],
      errors: [],
      skipped: []
    };

    for (const studentData of studentsData) {
      try {
        const result = await createOrUpdateStudentForSemester({
          currentUser,
          studentData,
          semesterContext
        });

        if (result.success) {
          if (result.isNewStudent) {
            results.success.push({
              student: result.student,
              message: result.message
            });
          } else {
            results.skipped.push({
              student: result.student,
              message: result.message
            });
          }
        } else {
          results.errors.push({
            studentData,
            error: result.error
          });
        }
      } catch (error) {
        results.errors.push({
          studentData,
          error: error.message
        });
      }
    }

    console.log(`📊 Bulk processing completed: ${results.success.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`);

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error in bulk create/update:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

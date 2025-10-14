/**
 * Faculty Ownership Binding Service
 * Manages faculty-class assignments and ensures proper ownership validation
 */

import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';
import User from '../models/User.js';

/**
 * Gets the faculty's assigned class information
 * @param {string} facultyId - Faculty user ID
 * @returns {Object} - Faculty class assignment info
 */
export async function getFacultyClassAssignment(facultyId) {
  try {
    console.log('🔍 Getting faculty class assignment for:', facultyId);
    
    // First check ClassAssignment model
    const classAssignment = await ClassAssignment.findOne({
      facultyId: facultyId,
      active: true
    }).populate('facultyId', 'name email');
    
    if (classAssignment) {
      console.log('✅ Found class assignment:', classAssignment);
      return {
        success: true,
        data: {
          facultyId: classAssignment.facultyId._id,
          facultyName: classAssignment.facultyId.name,
          classId: `${classAssignment.batch}_${classAssignment.year}_Sem ${classAssignment.semester}_${classAssignment.section}`,
          batch: classAssignment.batch,
          year: classAssignment.year,
          semester: classAssignment.semester,
          section: classAssignment.section,
          department: classAssignment.departmentId,
          source: 'ClassAssignment'
        }
      };
    }
    
    // Fallback to Faculty model
    const faculty = await Faculty.findOne({
      userId: facultyId,
      is_class_advisor: true,
      status: 'active'
    }).populate('userId', 'name email department');
    
    if (faculty) {
      console.log('✅ Found faculty record:', faculty);
      return {
        success: true,
        data: {
          facultyId: faculty._id,
          facultyName: faculty.userId.name,
          classId: `${faculty.batch}_${faculty.year}_Sem ${faculty.semester}_${faculty.section}`,
          batch: faculty.batch,
          year: faculty.year,
          semester: faculty.semester,
          section: faculty.section,
          department: faculty.userId.department,
          source: 'Faculty'
        }
      };
    }
    
    // If no specific assignment found, check if user is a general faculty member
    const generalFaculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    }).populate('userId', 'name email department');
    
    if (generalFaculty) {
      console.log('⚠️ No specific class assignment, using general faculty info');
      return {
        success: true,
        data: {
          facultyId: generalFaculty._id,
          facultyName: generalFaculty.userId.name,
          classId: null, // No specific class assigned
          batch: generalFaculty.batch || null,
          year: generalFaculty.year || null,
          semester: generalFaculty.semester || null,
          section: generalFaculty.section || null,
          department: generalFaculty.userId.department,
          source: 'GeneralFaculty'
        }
      };
    }
    
    console.log('❌ No faculty assignment found');
    return {
      success: false,
      error: {
        message: 'No class assignment found for this faculty member',
        code: 'NO_CLASS_ASSIGNMENT'
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting faculty class assignment:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving faculty class assignment',
        code: 'FACULTY_ASSIGNMENT_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Validates if a faculty is authorized to manage a specific class
 * @param {string} facultyId - Faculty user ID
 * @param {string} classId - Class ID to validate
 * @returns {Object} - Validation result
 */
export async function validateFacultyClassAuthorization(facultyId, classId) {
  try {
    const assignment = await getFacultyClassAssignment(facultyId);
    
    if (!assignment.success) {
      return assignment;
    }
    
    // If no specific class assigned, allow access (general faculty)
    if (!assignment.data.classId) {
      return {
        success: true,
        data: assignment.data
      };
    }
    
    // Check if the requested classId matches the assigned class
    if (assignment.data.classId === classId) {
      return {
        success: true,
        data: assignment.data
      };
    }
    
    return {
      success: false,
      error: {
        message: 'Faculty is not authorized to manage this class',
        code: 'UNAUTHORIZED_CLASS_ACCESS'
      }
    };
    
  } catch (error) {
    console.error('❌ Error validating faculty class authorization:', error);
    return {
      success: false,
      error: {
        message: 'Error validating faculty authorization',
        code: 'AUTHORIZATION_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Gets the faculty's current class context for student operations
 * @param {string} facultyId - Faculty user ID
 * @param {Object} classContext - Optional class context override
 * @returns {Object} - Faculty class context
 */
export async function getFacultyClassContext(facultyId, classContext = null) {
  try {
    // If class context is provided, use it
    if (classContext) {
      return {
        success: true,
        data: {
          facultyId: facultyId,
          classId: classContext.classId,
          batch: classContext.batch,
          year: classContext.year,
          semester: classContext.semester,
          section: classContext.section,
          department: classContext.department,
          source: 'Provided'
        }
      };
    }
    
    // Otherwise, get from faculty assignment
    return await getFacultyClassAssignment(facultyId);
    
  } catch (error) {
    console.error('❌ Error getting faculty class context:', error);
    return {
      success: false,
      error: {
        message: 'Error getting faculty class context',
        code: 'CONTEXT_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Faculty-Class Mapping Service
 * Manages the relationship between faculty and their assigned classes
 */

import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';
import { normalizeClassId } from '../utils/classIdNormalizer.js';

/**
 * Gets the class assignment for a faculty member
 * @param {string} facultyId - Faculty user ID
 * @param {Object} classContext - Class context (batch, year, semester, section, department)
 * @returns {Object} Class assignment data
 */
export async function getFacultyClassAssignment(facultyId, classContext) {
  try {
    console.log('🔍 Getting faculty class assignment:', { facultyId, classContext });
    
    // First try ClassAssignment model
    const classAssignment = await ClassAssignment.findOne({
      facultyId: facultyId,
      batch: classContext.batch,
      year: classContext.year,
      semester: typeof classContext.semester === 'number' ? classContext.semester : parseInt(classContext.semester.replace(/\D/g, '')),
      section: classContext.section || 'A',
      active: true
    });

    if (classAssignment) {
      const normalizedClassId = normalizeClassId({
        batch: classAssignment.batch,
        year: classAssignment.year,
        semester: classAssignment.semester,
        section: classAssignment.section
      });

      return {
        success: true,
        data: {
          facultyId: classAssignment.facultyId,
          classId: normalizedClassId,
          batch: classAssignment.batch,
          year: classAssignment.year,
          semester: classAssignment.semester,
          section: classAssignment.section,
          source: 'ClassAssignment'
        }
      };
    }

    // Fallback to Faculty model
    const faculty = await Faculty.findOne({
      userId: facultyId,
      is_class_advisor: true,
      batch: classContext.batch,
      year: classContext.year,
      semester: typeof classContext.semester === 'number' ? classContext.semester : parseInt(classContext.semester.replace(/\D/g, '')),
      department: classContext.department,
      status: 'active'
    });

    if (faculty) {
      const normalizedClassId = normalizeClassId({
        batch: faculty.batch,
        year: faculty.year,
        semester: faculty.semester,
        section: faculty.section
      });

      return {
        success: true,
        data: {
          facultyId: faculty._id,
          classId: normalizedClassId,
          batch: faculty.batch,
          year: faculty.year,
          semester: faculty.semester,
          section: faculty.section,
          source: 'Faculty'
        }
      };
    }

    // If no specific assignment found, check if user is a general faculty member
    const generalFaculty = await Faculty.findOne({
      userId: facultyId,
      department: classContext.department,
      status: 'active'
    });

    if (generalFaculty) {
      // Use the class context to create a virtual assignment
      const normalizedClassId = normalizeClassId({
        batch: classContext.batch,
        year: classContext.year,
        semester: classContext.semester,
        section: classContext.section || 'A'
      });

      return {
        success: true,
        data: {
          facultyId: facultyId,
          classId: normalizedClassId,
          batch: classContext.batch,
          year: classContext.year,
          semester: classContext.semester,
          section: classContext.section || 'A',
          source: 'Virtual'
        }
      };
    }

    return {
      success: false,
      error: {
        message: 'Faculty not authorized for this class',
        code: 'FACULTY_NOT_AUTHORIZED'
      }
    };

  } catch (error) {
    console.error('❌ Error getting faculty class assignment:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving faculty class assignment',
        code: 'DATABASE_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Creates a class assignment for a faculty member
 * @param {string} facultyId - Faculty user ID
 * @param {Object} classContext - Class context
 * @param {string} assignedBy - User ID who assigned the class
 * @returns {Object} Created assignment data
 */
export async function createFacultyClassAssignment(facultyId, classContext, assignedBy) {
  try {
    console.log('📝 Creating faculty class assignment:', { facultyId, classContext, assignedBy });
    
    const normalizedClassId = normalizeClassId({
      batch: classContext.batch,
      year: classContext.year,
      semester: classContext.semester,
      section: classContext.section || 'A'
    });

    const assignmentData = {
      facultyId: facultyId,
      batch: classContext.batch,
      year: classContext.year,
      semester: typeof classContext.semester === 'number' ? classContext.semester : parseInt(classContext.semester.replace(/\D/g, '')),
      section: classContext.section || 'A',
      assignedBy: assignedBy,
      active: true
    };

    const classAssignment = await ClassAssignment.create(assignmentData);

    return {
      success: true,
      data: {
        facultyId: classAssignment.facultyId,
        classId: normalizedClassId,
        batch: classAssignment.batch,
        year: classAssignment.year,
        semester: classAssignment.semester,
        section: classAssignment.section,
        source: 'Created'
      }
    };

  } catch (error) {
    console.error('❌ Error creating faculty class assignment:', error);
    return {
      success: false,
      error: {
        message: 'Error creating faculty class assignment',
        code: 'DATABASE_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Gets all class assignments for a faculty member
 * @param {string} facultyId - Faculty user ID
 * @returns {Object} List of class assignments
 */
export async function getFacultyClassAssignments(facultyId) {
  try {
    console.log('🔍 Getting all class assignments for faculty:', facultyId);
    
    const assignments = await ClassAssignment.find({
      facultyId: facultyId,
      active: true
    }).sort({ createdAt: -1 });

    const normalizedAssignments = assignments.map(assignment => {
      const normalizedClassId = normalizeClassId({
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section
      });

      return {
        id: assignment._id,
        facultyId: assignment.facultyId,
        classId: normalizedClassId,
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section,
        assignedDate: assignment.assignedDate
      };
    });

    return {
      success: true,
      data: normalizedAssignments
    };

  } catch (error) {
    console.error('❌ Error getting faculty class assignments:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving faculty class assignments',
        code: 'DATABASE_ERROR',
        details: error.message
      }
    };
  }
}

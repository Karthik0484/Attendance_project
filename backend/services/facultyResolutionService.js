/**
 * Centralized Faculty ID Resolution Service
 * Ensures consistent faculty ID resolution across all operations
 */

import Faculty from '../models/Faculty.js';
import FacultyAuditLog from '../models/FacultyAuditLog.js';

/**
 * Resolve faculty ID using multiple strategies in priority order
 * @param {Object} options - Resolution options
 * @param {Object} options.user - Current user session
 * @param {String} options.classId - Class identifier
 * @param {String} options.batch - Academic batch
 * @param {String} options.year - Academic year
 * @param {String} options.semester - Semester
 * @param {String} options.section - Section
 * @param {String} options.department - Department
 * @returns {Object} - { facultyId, faculty, source }
 */
export async function resolveFacultyId(options) {
  const { user, classId, batch, year, semester, section, department } = options;
  
  console.log('🔍 Resolving faculty ID with options:', {
    userId: user?._id,
    classId,
    batch,
    year,
    semester,
    section,
    department
  });

  // Strategy 1: Logged-in user session (highest priority)
  if (user && user.role === 'faculty') {
    const faculty = await Faculty.findOne({
      userId: user._id,
      is_class_advisor: true,
      status: 'active'
    });

    if (faculty) {
      console.log('✅ Faculty resolved from user session:', faculty._id);
      return {
        facultyId: faculty._id,
        faculty,
        source: 'user_session'
      };
    }
  }

  // Strategy 2: Class mapping lookup using classId
  if (classId) {
    const faculty = await Faculty.findOne({
      classId: classId,
      is_class_advisor: true,
      status: 'active'
    });

    if (faculty) {
      console.log('✅ Faculty resolved from classId mapping:', faculty._id);
      return {
        facultyId: faculty._id,
        faculty,
        source: 'class_mapping'
      };
    }
  }

  // Strategy 3: Batch/Year/Semester lookup
  if (batch && year && semester) {
    const faculty = await Faculty.findOne({
      batch,
      year,
      semester: parseInt(String(semester), 10) || parseInt(String(semester).match(/\d+/)?.[0] || '0', 10),
      ...(section ? { section } : {}),
      department,
      is_class_advisor: true,
      status: 'active'
    });

    if (faculty) {
      console.log('✅ Faculty resolved from batch/year/semester lookup:', faculty._id);
      return {
        facultyId: faculty._id,
        faculty,
        source: 'batch_lookup'
      };
    }
  }

  // Strategy 4: Department-based lookup (fallback)
  if (department) {
    const faculty = await Faculty.findOne({
      department,
      is_class_advisor: true,
      status: 'active'
    });

    if (faculty) {
      console.log('⚠️ Faculty resolved from department fallback:', faculty._id);
      return {
        facultyId: faculty._id,
        faculty,
        source: 'department_fallback'
      };
    }
  }

  console.error('❌ No faculty found for the given criteria');
  throw new Error('No valid faculty found for the specified class');
}

/**
 * Validate faculty-class binding
 * @param {String} facultyId - Faculty ID to validate
 * @param {String} classId - Class ID to validate against
 * @param {Object} classMetadata - Additional class metadata
 * @returns {Boolean} - Whether the binding is valid
 */
export async function validateFacultyClassBinding(facultyId, classId, classMetadata = {}) {
  try {
    const faculty = await Faculty.findOne({
      _id: facultyId,
      is_class_advisor: true,
      status: 'active'
    });

    if (!faculty) {
      console.error('❌ Faculty not found or not authorized:', facultyId);
      return false;
    }

    // Check if faculty is assigned to this specific class
    const { batch, year, semester, section, department } = classMetadata;
    
    // First check ClassAssignment model for this specific class
    const ClassAssignment = (await import('../models/ClassAssignment.js')).default;
    const classAssignment = await ClassAssignment.findOne({
      facultyId: facultyId,
      batch: batch,
      year: year,
      semester: typeof semester === 'string' ? parseInt(semester.replace(/\D/g, '')) : semester,
      section: section || 'A',
      active: true
    });

    if (classAssignment) {
      console.log('✅ Faculty is assigned to this class via ClassAssignment');
      return true;
    }

    // If no specific class assignment found, check if faculty is a general class advisor
    // and allow them to upload students for any class in their department
    console.log('⚠️ No specific class assignment found, checking if faculty is authorized for this class...');
    
    // Check if faculty is assigned to any class with the same year and semester
    const anyClassAssignment = await ClassAssignment.findOne({
      facultyId: facultyId,
      year: year,
      semester: typeof semester === 'string' ? parseInt(semester.replace(/\D/g, '')) : semester,
      section: section || 'A',
      active: true
    });

    if (anyClassAssignment) {
      console.log('✅ Faculty is assigned to a class with same year/semester, allowing upload');
      return true;
    }

    // If still no assignment found, check if faculty is a general class advisor
    // and allow them to upload students for any class in their department
    if (faculty.is_class_advisor && faculty.department === department) {
      console.log('✅ Faculty is a class advisor in the same department, allowing upload');
      return true;
    }

    // If we reach here, the faculty is not specifically assigned to this class
    // but we've already checked if they're a general class advisor
    console.log('❌ Faculty is not authorized for this specific class');
    return false;

  } catch (error) {
    console.error('❌ Error validating faculty-class binding:', error);
    return false;
  }
}

/**
 * Generate class metadata from classId
 * @param {String} classId - Class identifier
 * @returns {Object} - Parsed class metadata
 */
export function parseClassId(classId) {
  if (!classId) return {};

  const parts = classId.split('_');
  if (parts.length < 4) return {};

  return {
    batch: parts[0],
    year: parts[1],
    semester: parts[2],
    section: parts[3]
  };
}

/**
 * Create audit log entry for faculty ID resolution
 * @param {Object} options - Audit options
 * @param {String} options.operation - Operation type (manual/bulk)
 * @param {String} options.facultyId - Resolved faculty ID
 * @param {String} options.classId - Class ID
 * @param {String} options.source - Resolution source
 * @param {String} options.userId - User who performed the operation
 * @param {Number} options.studentCount - Number of students affected
 * @param {Array} options.studentIds - Array of student IDs
 * @param {Object} options.details - Additional details
 * @param {String} options.status - Operation status
 * @param {String} options.errorMessage - Error message if any
 * @returns {Object} - Audit log entry
 */
export async function createAuditLog(options) {
  const { 
    operation, 
    facultyId, 
    classId, 
    source, 
    userId, 
    studentCount = 0, 
    studentIds = [], 
    details = {}, 
    status = 'success',
    errorMessage = null 
  } = options;
  
  try {
    const auditEntry = new FacultyAuditLog({
      operation,
      facultyId,
      classId,
      source,
      userId,
      studentCount,
      studentIds,
      details,
      status,
      errorMessage,
      resolvedAt: new Date()
    });
    
    await auditEntry.save();
    
    console.log('📝 Faculty ID resolution audit logged:', {
      operation,
      facultyId,
      classId,
      source,
      studentCount,
      status
    });
    
    return auditEntry;
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
}

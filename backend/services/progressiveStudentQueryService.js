/**
 * Progressive Student Query Service
 * Implements progressive search logic with fallback queries and auto-correction
 */

import Student from '../models/Student.js';
import { normalizeClassId, parseClassId } from '../utils/classIdNormalizer.js';
import { getFacultyClassAssignment } from './facultyClassMappingService.js';

/**
 * Progressive student retrieval with auto-correction
 * @param {Object} options - Query options
 * @param {string} options.facultyId - Faculty user ID
 * @param {string} options.classId - Normalized class ID
 * @param {Object} options.classContext - Class context (batch, year, semester, section, department)
 * @param {boolean} options.autoCorrect - Whether to auto-correct missing/mismatched fields
 * @returns {Object} Query result with students and correction info
 */
export async function getStudentsProgressive(options) {
  const { facultyId, classId, classContext, autoCorrect = true } = options;
  
  try {
    console.log('🔍 Progressive student query:', { facultyId, classId, classContext, autoCorrect });
    
    // Step 1: Primary Query - Use class context instead of classAssigned
    let students = await Student.find({
      batch: classContext.batch,
      year: classContext.year,
      semester: classContext.semester,
      section: classContext.section,
      department: classContext.department,
      status: 'active'
    }).select('rollNumber name email classAssigned facultyId batch year semester section department createdBy');
    
    console.log(`📊 Primary query (class context): ${students.length} students`);
    
    // Step 2: Secondary Query - Try with classAssigned if no students found
    if (students.length === 0) {
      console.log('⚠️ No students found with class context, trying classAssigned...');
      
      students = await Student.find({
        classAssigned: classId,
        status: 'active'
      }).select('rollNumber name email classAssigned facultyId batch year semester section department createdBy');
      
      console.log(`📊 Secondary query (classAssigned): ${students.length} students`);
      
      // Auto-correct facultyId if students found
      if (students.length > 0 && autoCorrect) {
        console.log('🔧 Auto-correcting facultyId for found students...');
        await Student.updateMany(
          { classAssigned: classId, status: 'active' },
          { $set: { facultyId: facultyId, updatedAt: new Date() } }
        );
        console.log(`✅ Updated facultyId for ${students.length} students`);
      }
    }
    
    // Step 3: Final Query - individual fields (if still none found)
    if (students.length === 0) {
      console.log('⚠️ No students found with classId, trying individual fields...');
      
      const parsedClassId = parseClassId(classId);
      if (parsedClassId.isValid) {
        const { batch, year, semester, section } = parsedClassId;
        
        students = await Student.find({
          batch: batch,
          year: year,
          semester: semester,
          section: section,
          status: 'active'
        }).select('rollNumber name email classId facultyId batch year semester section department createdBy');
        
        console.log(`📊 Final query (individual fields): ${students.length} students`);
        
        // Auto-correct both facultyId and classId if students found
        if (students.length > 0 && autoCorrect) {
          console.log('🔧 Auto-correcting facultyId and classId for found students...');
          await Student.updateMany(
            { 
              batch: batch,
              year: year,
              semester: semester,
              section: section,
              status: 'active'
            },
            { 
              $set: { 
                facultyId: facultyId,
                classAssigned: classId,
                updatedAt: new Date()
              } 
            }
          );
          console.log(`✅ Updated facultyId and classId for ${students.length} students`);
        }
      }
    }
    
    // Step 4: Department-based fallback (if still none found)
    if (students.length === 0 && classContext.department) {
      console.log('⚠️ No students found with individual fields, trying department-based search...');
      
      const parsedClassId = parseClassId(classId);
      if (parsedClassId.isValid) {
        const { batch, year, semester, section } = parsedClassId;
        
        students = await Student.find({
          batch: batch,
          year: year,
          semester: semester,
          section: section,
          department: classContext.department,
          status: 'active'
        }).select('rollNumber name email classId facultyId batch year semester section department createdBy');
        
        console.log(`📊 Department-based query: ${students.length} students`);
        
        // Auto-correct all fields if students found
        if (students.length > 0 && autoCorrect) {
          console.log('🔧 Auto-correcting all fields for found students...');
          await Student.updateMany(
            { 
              batch: batch,
              year: year,
              semester: semester,
              section: section,
              department: classContext.department,
              status: 'active'
            },
            { 
              $set: { 
                facultyId: facultyId,
                classAssigned: classId,
                updatedAt: new Date()
              } 
            }
          );
          console.log(`✅ Updated all fields for ${students.length} students`);
        }
      }
    }
    
    // Step 5: Validate and normalize retrieved students
    const normalizedStudents = students.map(student => ({
      _id: student._id,
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email,
      classAssigned: student.classAssigned,
      facultyId: student.facultyId,
      batch: student.batch,
      year: student.year,
      semester: student.semester,
      section: student.section,
      department: student.department,
      createdBy: student.createdBy
    }));
    
    console.log(`✅ Progressive query completed: ${normalizedStudents.length} students found`);
    
    return {
      success: true,
      data: {
        students: normalizedStudents,
        totalCount: normalizedStudents.length,
        queryMethod: students.length > 0 ? 'success' : 'no_results',
        correctionsApplied: autoCorrect && students.length > 0
      }
    };
    
  } catch (error) {
    console.error('❌ Error in progressive student query:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving students',
        code: 'QUERY_ERROR',
        details: error.message
      }
    };
  }
}

/**
 * Validates student data integrity
 * @param {Array} students - Array of student objects
 * @param {string} expectedClassId - Expected class ID
 * @param {string} expectedFacultyId - Expected faculty ID
 * @returns {Object} Validation result
 */
export function validateStudentDataIntegrity(students, expectedClassId, expectedFacultyId) {
  const issues = [];
  
  students.forEach((student, index) => {
    // Check classId
    if (student.classId !== expectedClassId) {
      issues.push({
        studentIndex: index,
        rollNumber: student.rollNumber,
        field: 'classId',
        expected: expectedClassId,
        actual: student.classId,
        issue: 'Mismatched classId'
      });
    }
    
    // Check facultyId
    if (student.facultyId.toString() !== expectedFacultyId.toString()) {
      issues.push({
        studentIndex: index,
        rollNumber: student.rollNumber,
        field: 'facultyId',
        expected: expectedFacultyId,
        actual: student.facultyId,
        issue: 'Mismatched facultyId'
      });
    }
    
    // Check required fields
    const requiredFields = ['rollNumber', 'name', 'email', 'batch', 'year', 'semester', 'section'];
    requiredFields.forEach(field => {
      if (!student[field]) {
        issues.push({
          studentIndex: index,
          rollNumber: student.rollNumber,
          field: field,
          expected: 'Non-empty value',
          actual: student[field],
          issue: 'Missing required field'
        });
      }
    });
  });
  
  return {
    isValid: issues.length === 0,
    issues: issues,
    totalIssues: issues.length
  };
}

/**
 * Auto-corrects student data issues
 * @param {Array} students - Array of student objects
 * @param {string} expectedClassId - Expected class ID
 * @param {string} expectedFacultyId - Expected faculty ID
 * @returns {Object} Correction result
 */
export async function autoCorrectStudentData(students, expectedClassId, expectedFacultyId) {
  const corrections = [];
  
  for (const student of students) {
    const updates = {};
    
    // Correct classId if mismatched
    if (student.classId !== expectedClassId) {
      updates.classId = expectedClassId;
      corrections.push({
        studentId: student._id,
        rollNumber: student.rollNumber,
        field: 'classId',
        oldValue: student.classId,
        newValue: expectedClassId
      });
    }
    
    // Correct facultyId if mismatched
    if (student.facultyId.toString() !== expectedFacultyId.toString()) {
      updates.facultyId = expectedFacultyId;
      corrections.push({
        studentId: student._id,
        rollNumber: student.rollNumber,
        field: 'facultyId',
        oldValue: student.facultyId,
        newValue: expectedFacultyId
      });
    }
    
    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await Student.findByIdAndUpdate(student._id, { $set: updates });
    }
  }
  
  return {
    success: true,
    correctionsApplied: corrections.length,
    corrections: corrections
  };
}

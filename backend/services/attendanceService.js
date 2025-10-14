/**
 * Attendance Management Service
 * Handles all attendance operations with data integrity and validation
 */

import mongoose from 'mongoose';
import ClassAttendance from '../models/ClassAttendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import { getISTDate, normalizeDateToUTC } from '../utils/dateUtils.js';
import { getStudentsProgressive } from './progressiveStudentQueryService.js';
import { getFacultyClassAssignment } from './facultyClassMappingService.js';

/**
 * Mark attendance for a class on a specific date
 */
export async function markAttendance(options) {
  const { facultyId, classId, date, absentStudents, notes } = options;
  
  try {
    console.log('📝 Marking attendance:', { facultyId, classId, date, absentCount: absentStudents.length });
    
    // Normalize date to UTC midnight
    const normalizedDate = normalizeDateToUTC(date);
    
    // Get class information and validate faculty authorization
    const classInfo = await getClassInfo(classId, facultyId);
    if (!classInfo.success) {
      return { success: false, error: classInfo.error };
    }
    
    // Parse classId to get class context
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return {
        success: false,
        error: {
          message: 'Invalid classId format',
          code: 'INVALID_CLASS_ID'
        }
      };
    }
    
    const [batch, year, semester, section] = parts;
    const classContext = {
      batch,
      year,
      semester,
      section,
      department: classInfo.data.department
    };
    
    // Use progressive query service to get students with auto-correction
    const studentQueryResult = await getStudentsProgressive({
      facultyId: facultyId,
      classId: classId,
      classContext: classContext,
      autoCorrect: true
    });
    
    if (!studentQueryResult.success) {
      return { success: false, error: studentQueryResult.error };
    }
    
    const students = studentQueryResult.data.students;
    
    if (students.length === 0) {
      return {
        success: false,
        error: {
          message: 'No students found in this class',
          code: 'NO_STUDENTS'
        }
      };
    }
    
    console.log(`✅ Retrieved ${students.length} students using progressive query`);
    
    // Validate absent students
    const validAbsentStudents = validateAbsentStudents(absentStudents, students);
    if (!validAbsentStudents.success) {
      return { success: false, error: validAbsentStudents.error };
    }
    
    // Calculate present students
    const allRollNumbers = students.map(s => s.rollNumber);
    const presentStudents = allRollNumbers.filter(rollNumber => 
      !validAbsentStudents.data.includes(rollNumber)
    );
    
    // Check if attendance already exists
    const existingAttendance = await ClassAttendance.findOne({
      facultyId: facultyId,
      classId: classId,
      date: normalizedDate
    });
    
    let attendanceRecord;
    
    if (existingAttendance) {
      // Update existing record
      console.log('📝 Updating existing attendance record');
      existingAttendance.presentStudents = presentStudents;
      existingAttendance.absentStudents = validAbsentStudents.data;
      existingAttendance.totalStudents = allRollNumbers.length;
      existingAttendance.totalPresent = presentStudents.length;
      existingAttendance.totalAbsent = validAbsentStudents.data.length;
      existingAttendance.updatedBy = facultyId;
      existingAttendance.status = 'modified';
      if (notes) existingAttendance.notes = notes;
      
      attendanceRecord = await existingAttendance.save();
    } else {
      // Create new record
      console.log('📝 Creating new attendance record');
      attendanceRecord = new ClassAttendance({
        facultyId: facultyId,
        classId: classId,
        date: normalizedDate,
        presentStudents: presentStudents,
        absentStudents: validAbsentStudents.data,
        totalStudents: allRollNumbers.length,
        totalPresent: presentStudents.length,
        totalAbsent: validAbsentStudents.data.length,
        batch: classInfo.data.batch,
        year: classInfo.data.year,
        semester: classInfo.data.semester,
        section: classInfo.data.section,
        department: classInfo.data.department,
        createdBy: facultyId,
        updatedBy: facultyId,
        status: 'finalized',
        notes: notes || ''
      });
      
      await attendanceRecord.save();
    }
    
    console.log('✅ Attendance marked successfully:', {
      id: attendanceRecord._id,
      totalStudents: attendanceRecord.totalStudents,
      present: attendanceRecord.totalPresent,
      absent: attendanceRecord.totalAbsent
    });
    
    return {
      success: true,
      data: {
        attendance: attendanceRecord,
        students: students,
        summary: {
          totalStudents: attendanceRecord.totalStudents,
          totalPresent: attendanceRecord.totalPresent,
          totalAbsent: attendanceRecord.totalAbsent,
          attendancePercentage: attendanceRecord.attendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error marking attendance:', error);
    return {
      success: false,
      error: {
        message: 'Error marking attendance',
        details: error.message
      }
    };
  }
}

/**
 * Get attendance history for a class
 */
export async function getAttendanceHistory(options) {
  const { facultyId, classId, startDate, endDate, limit = 50, page = 1 } = options;
  
  try {
    console.log('📊 Getting attendance history:', { facultyId, classId, startDate, endDate });
    
    // Build query
    const query = { facultyId: facultyId, classId: classId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = normalizeDateToUTC(startDate);
      if (endDate) query.date.$lte = normalizeDateToUTC(endDate);
    }
    
    // Get attendance records
    const attendanceRecords = await ClassAttendance.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy updatedBy', 'name email');
    
    const total = await ClassAttendance.countDocuments(query);
    
    console.log(`✅ Found ${attendanceRecords.length} attendance records`);
    
    return {
      success: true,
      data: {
        records: attendanceRecords,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total: total
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting attendance history:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving attendance history',
        details: error.message
      }
    };
  }
}

/**
 * Get attendance details for a specific date
 */
export async function getAttendanceDetails(facultyId, classId, date) {
  try {
    console.log('📋 Getting attendance details:', { facultyId, classId, date });
    
    const normalizedDate = normalizeDateToUTC(date);
    
    const attendanceRecord = await ClassAttendance.findOne({
      facultyId: facultyId,
      classId: classId,
      date: normalizedDate
    });
    
    if (!attendanceRecord) {
      return {
        success: false,
        error: {
          message: 'No attendance record found for this date',
          code: 'NOT_FOUND'
        }
      };
    }
    
    // Get student details for present/absent lists
    const students = await Student.find({
      classId: classId,
      facultyId: facultyId,
      status: 'active'
    }).select('rollNumber name email');
    
    const presentStudents = students.filter(student => 
      attendanceRecord.presentStudents.includes(student.rollNumber)
    );
    
    const absentStudents = students.filter(student => 
      attendanceRecord.absentStudents.includes(student.rollNumber)
    );
    
    return {
      success: true,
      data: {
        attendance: attendanceRecord,
        presentStudents: presentStudents,
        absentStudents: absentStudents,
        summary: {
          totalStudents: attendanceRecord.totalStudents,
          totalPresent: attendanceRecord.totalPresent,
          totalAbsent: attendanceRecord.totalAbsent,
          attendancePercentage: attendanceRecord.attendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error getting attendance details:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving attendance details',
        details: error.message
      }
    };
  }
}

/**
 * Generate attendance report for a class
 */
export async function generateAttendanceReport(options) {
  const { facultyId, classId, startDate, endDate } = options;
  
  try {
    console.log('📊 Generating attendance report:', { facultyId, classId, startDate, endDate });
    
    // Get all students in the class
    const students = await Student.find({
      classId: classId,
      facultyId: facultyId,
      status: 'active'
    }).select('rollNumber name email');
    
    if (students.length === 0) {
      return {
        success: false,
        error: {
          message: 'No students found in this class',
          code: 'NO_STUDENTS'
        }
      };
    }
    
    // Build date query
    const query = { facultyId: facultyId, classId: classId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = normalizeDateToUTC(startDate);
      if (endDate) query.date.$lte = normalizeDateToUTC(endDate);
    }
    
    // Get all attendance records
    const attendanceRecords = await ClassAttendance.find(query).sort({ date: 1 });
    
    // Calculate per-student statistics
    const studentReports = students.map(student => {
      let totalDays = 0;
      let absentDays = 0;
      
      attendanceRecords.forEach(record => {
        totalDays++;
        if (record.absentStudents.includes(student.rollNumber)) {
          absentDays++;
        }
      });
      
      const presentDays = totalDays - absentDays;
      const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100 * 100) / 100 : 0;
      
      return {
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        totalDays: totalDays,
        presentDays: presentDays,
        absentDays: absentDays,
        attendancePercentage: attendancePercentage
      };
    });
    
    // Calculate class statistics
    const totalDays = attendanceRecords.length;
    const totalPossibleAttendance = students.length * totalDays;
    const totalAbsentCount = attendanceRecords.reduce((sum, record) => sum + record.totalAbsent, 0);
    const totalPresentCount = totalPossibleAttendance - totalAbsentCount;
    const classAttendancePercentage = totalPossibleAttendance > 0 ? 
      Math.round((totalPresentCount / totalPossibleAttendance) * 100 * 100) / 100 : 0;
    
    console.log('✅ Attendance report generated successfully');
    
    return {
      success: true,
      data: {
        classInfo: {
          classId: classId,
          totalStudents: students.length,
          totalDays: totalDays,
          classAttendancePercentage: classAttendancePercentage
        },
        studentReports: studentReports,
        summary: {
          totalStudents: students.length,
          totalDays: totalDays,
          totalPresentCount: totalPresentCount,
          totalAbsentCount: totalAbsentCount,
          classAttendancePercentage: classAttendancePercentage
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Error generating attendance report:', error);
    return {
      success: false,
      error: {
        message: 'Error generating attendance report',
        details: error.message
      }
    };
  }
}

/**
 * Check if attendance can be edited (within allowed time window)
 */
export function canEditAttendance(attendanceDate, editWindowDays = 7) {
  const today = new Date();
  const attendanceDateObj = new Date(attendanceDate);
  const daysDifference = Math.floor((today - attendanceDateObj) / (1000 * 60 * 60 * 24));
  
  return daysDifference <= editWindowDays;
}

/**
 * Get class information from classId
 */
async function getClassInfo(classId, facultyId) {
  try {
    // Parse classId to extract components
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return {
        success: false,
        error: {
          message: 'Invalid classId format',
          code: 'INVALID_CLASS_ID'
        }
      };
    }
    
    const [batch, year, semester, section] = parts;
    
    // Get faculty info
    const faculty = await Faculty.findById(facultyId);
    if (!faculty) {
      return {
        success: false,
        error: {
          message: 'Faculty not found',
          code: 'FACULTY_NOT_FOUND'
        }
      };
    }
    
    return {
      success: true,
      data: {
        batch: batch,
        year: year,
        semester: semester,
        section: section,
        department: faculty.department
      }
    };
    
  } catch (error) {
    console.error('Error getting class info:', error);
    return {
      success: false,
      error: {
        message: 'Error retrieving class information',
        details: error.message
      }
    };
  }
}

/**
 * Validate absent students list
 */
function validateAbsentStudents(absentStudents, allStudents) {
  const allRollNumbers = allStudents.map(s => s.rollNumber);
  const invalidRollNumbers = [];
  const duplicateRollNumbers = [];
  const seen = new Set();
  
  for (const rollNumber of absentStudents) {
    if (!allRollNumbers.includes(rollNumber)) {
      invalidRollNumbers.push(rollNumber);
    }
    
    if (seen.has(rollNumber)) {
      duplicateRollNumbers.push(rollNumber);
    } else {
      seen.add(rollNumber);
    }
  }
  
  if (invalidRollNumbers.length > 0) {
    return {
      success: false,
      error: {
        message: 'Invalid roll numbers not found in class',
        code: 'INVALID_ROLL_NUMBERS',
        details: invalidRollNumbers
      }
    };
  }
  
  if (duplicateRollNumbers.length > 0) {
    return {
      success: false,
      error: {
        message: 'Duplicate roll numbers found',
        code: 'DUPLICATE_ROLL_NUMBERS',
        details: duplicateRollNumbers
      }
    };
  }
  
  return {
    success: true,
    data: absentStudents
  };
}

export default {
  markAttendance,
  getAttendanceHistory,
  getAttendanceDetails,
  generateAttendanceReport,
  canEditAttendance
};

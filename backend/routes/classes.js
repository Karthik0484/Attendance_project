/**
 * Class-based Routes
 * Handles class-specific operations including student retrieval
 */

import express from 'express';
import mongoose from 'mongoose';
import Student from '../models/Student.js';
import ClassAssignment from '../models/ClassAssignment.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove, hodAndAbove } from '../middleware/auth.js';

const router = express.Router();

/**
 * Middleware: Verify faculty is assigned to the class
 */
const verifyClassAccess = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log('🔒 [CLASS ACCESS] Verifying access:', { classId, userId, userRole });

    // HOD, Principal, and Admin can access any class in their department
    if (['hod', 'principal', 'admin'].includes(userRole)) {
      console.log('✅ [CLASS ACCESS] Admin-level access granted');
      return next();
    }

    // Faculty must be assigned to this class
    const assignment = await ClassAssignment.findById(classId)
      .populate('facultyId', 'name email');

    if (!assignment) {
      console.log('❌ [CLASS ACCESS] Class assignment not found');
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if this faculty is assigned to this class
    if (assignment.facultyId._id.toString() !== userId.toString()) {
      console.log('❌ [CLASS ACCESS] Faculty not assigned to this class');
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this class'
      });
    }

    // Allow access to both active AND archived classes for faculty
    // Faculty can view their past assignments for reference
    console.log('✅ [CLASS ACCESS] Access granted', {
      active: assignment.active,
      status: assignment.status,
      isArchived: !assignment.active || assignment.status !== 'Active'
    });
    
    // Attach assignment data to request for use in route handler
    req.classAssignment = assignment;
    req.isArchivedClass = !assignment.active || assignment.status !== 'Active';
    next();

  } catch (error) {
    console.error('❌ [CLASS ACCESS] Error verifying access:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying class access',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/classes/:classId/students
 * Fetch all students enrolled in a specific class
 * 
 * Authorization: Faculty must be assigned to the class, or be HOD/Admin
 */
router.get('/:classId/students', authenticate, facultyAndAbove, verifyClassAccess, async (req, res) => {
  try {
    const { classId } = req.params;
    const assignment = req.classAssignment;

    console.log('📚 [GET STUDENTS] Fetching students for class:', classId);
    console.log('📋 [GET STUDENTS] Assignment details:', {
      batch: assignment.batch,
      year: assignment.year,
      semester: assignment.semester,
      semesterType: typeof assignment.semester,
      section: assignment.section,
      department: assignment.departmentId
    });

    // Build the classId string for querying
    // Format: batch_year_semester_section
    // IMPORTANT: ClassAssignment stores semester as Number (e.g., 3)
    // but Student classId uses string format "Sem 3"
    const semesterString = typeof assignment.semester === 'number' 
      ? `Sem ${assignment.semester}` 
      : assignment.semester.toString();
    
    const classIdString = `${assignment.batch}_${assignment.year}_${semesterString}_${assignment.section}`;
    console.log('🔍 [GET STUDENTS] Looking for classId:', classIdString);
    console.log('🔍 [GET STUDENTS] Semester conversion:', assignment.semester, '=>', semesterString);

    // Query students with this classId in their active semester
    const students = await Student.find({
      'semesters.classId': classIdString,
      'semesters.status': 'active',
      status: 'active'
    })
    .select('rollNumber name email mobile parentMobile bloodGroup address department batchYear section status semesters')
    .populate('userId', 'name email')
    .sort({ rollNumber: 1 })
    .lean();

    console.log(`📊 [GET STUDENTS] Found ${students.length} students`);

    // Format students with their current semester info
    const formattedStudents = students.map(student => {
      // Find the matching semester entry
      const currentSemester = student.semesters.find(sem => 
        sem.classId === classIdString && 
        sem.status === 'active'
      );

      return {
        _id: student._id,
        rollNumber: student.rollNumber,  // Primary field from DB
        regNo: student.rollNumber,       // Alias for compatibility
        name: student.name,
        email: student.email,
        mobile: student.mobile,
        parentMobile: student.parentMobile,
        parentContact: student.parentMobile,  // Alias for frontend compatibility
        bloodGroup: student.bloodGroup,
        address: student.address,
        department: student.department,
        batchYear: student.batchYear,
        section: student.section,
        status: student.status,
        currentSemester: currentSemester ? {
          year: currentSemester.year,
          semesterName: currentSemester.semesterName,
          semesterNumber: currentSemester.semesterNumber,
          classId: currentSemester.classId,
          enrolledDate: currentSemester.enrolledDate,
          status: currentSemester.status
        } : null
      };
    });

    // Log sample for debugging
    if (formattedStudents.length > 0) {
      console.log('📝 [GET STUDENTS] Sample student:', {
        rollNumber: formattedStudents[0].rollNumber,
        regNo: formattedStudents[0].regNo,
        name: formattedStudents[0].name,
        classId: formattedStudents[0].currentSemester?.classId
      });
    }

    res.status(200).json({
      success: true,
      message: formattedStudents.length > 0 
        ? `Found ${formattedStudents.length} student(s)` 
        : 'No students found in this class',
      data: {
        students: formattedStudents,
        total: formattedStudents.length,
        classInfo: {
          classId: classIdString,
          batch: assignment.batch,
          year: assignment.year,
          semester: semesterString,  // Use converted semester format
          semesterNumber: assignment.semester,  // Include original number for reference
          section: assignment.section,
          department: assignment.departmentId,
          isArchived: req.isArchivedClass || false,  // Indicate if this is an archived class
          status: assignment.status,
          active: assignment.active
        }
      }
    });

  } catch (error) {
    console.error('❌ [GET STUDENTS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/classes/:classId
 * Get class assignment details
 */
router.get('/:classId', authenticate, facultyAndAbove, verifyClassAccess, async (req, res) => {
  try {
    const assignment = req.classAssignment;

    res.status(200).json({
      success: true,
      data: {
        _id: assignment._id,
        batch: assignment.batch,
        year: assignment.year,
        semester: assignment.semester,
        section: assignment.section,
        department: assignment.departmentId,
        faculty: {
          _id: assignment.facultyId._id,
          name: assignment.facultyId.name,
          email: assignment.facultyId.email
        },
        role: assignment.role,
        assignedDate: assignment.assignedDate,
        active: assignment.active,
        status: assignment.status
      }
    });

  } catch (error) {
    console.error('❌ [GET CLASS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching class details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


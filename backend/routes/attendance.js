/**
 * Attendance Routes
 * Handles attendance marking and editing operations
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';
import Attendance from '../models/Attendance.js';
import ClassAttendance from '../models/ClassAttendance.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { getHolidayCountForAnalytics } from '../services/holidayService.js';

const router = express.Router();

// Helper function to generate unique requestId for ApprovalRequest
async function generateRequestId(type) {
  const prefix = type.substring(0, 3).toUpperCase();
  const count = await ApprovalRequest.countDocuments({ type: type });
  return `${prefix}-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
}

// @desc    Get attendance record for a specific class and date
// @route   GET /api/attendance/:classId/:date
// @access  Faculty and above
router.get('/:classId/:date', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, date } = req.params;
    const facultyId = req.user._id;

    console.log('📋 Getting attendance record:', { classId, date, facultyId });

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Find attendance record
    const attendance = await Attendance.findOne({
      classId: classId,
      date: date,
      facultyId: faculty._id
    }).populate('records.studentId', 'rollNumber name email');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No attendance record found for this class and date'
      });
    }

    // Ensure all records have email information
    // If email is missing from the record, get it from populated studentId
    const processedRecords = attendance.records.map(record => {
      const recordObj = record.toObject ? record.toObject() : record;
      
      // If email is missing in the stored record but available in populated studentId
      if (!recordObj.email && recordObj.studentId && recordObj.studentId.email) {
        recordObj.email = recordObj.studentId.email;
      }
      
      // If studentId is populated, also update rollNumber and name if they don't match
      if (recordObj.studentId && typeof recordObj.studentId === 'object') {
        if (!recordObj.rollNumber && recordObj.studentId.rollNumber) {
          recordObj.rollNumber = recordObj.studentId.rollNumber;
        }
        if (!recordObj.name && recordObj.studentId.name) {
          recordObj.name = recordObj.studentId.name;
        }
      }
      
      return recordObj;
    });

    // Create a clean attendance object with processed records
    const attendanceData = attendance.toObject();
    attendanceData.records = processedRecords;

    console.log('✅ Attendance record found:', {
      id: attendance._id,
      totalStudents: attendance.totalStudents,
      totalPresent: attendance.totalPresent,
      totalAbsent: attendance.totalAbsent
    });

    res.json({
      success: true,
      data: {
        attendance: attendanceData,
        summary: {
          totalStudents: attendance.totalStudents,
          totalPresent: attendance.totalPresent,
          totalAbsent: attendance.totalAbsent,
          totalOD: attendance.totalOD || 0,
          attendancePercentage: attendance.attendancePercentage
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting attendance record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Update attendance record for a specific class and date
// @route   PUT /api/attendance/:classId/:date
// @access  Faculty and above
router.put('/:classId/:date', authenticate, facultyAndAbove, [
  body('records').isArray().withMessage('Records must be an array'),
  body('records.*.studentId').isMongoId().withMessage('Invalid student ID'),
  body('records.*.status').isIn(['present', 'absent', 'od']).withMessage('Status must be present, absent, or od'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
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

    const { classId, date } = req.params;
    const { records, notes } = req.body;
    const facultyId = req.user._id;

    console.log('📝 Updating attendance record:', { classId, date, facultyId, recordsCount: records?.length });

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if date is today (only allow editing today's attendance)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (date !== todayStr) {
      return res.status(400).json({
        success: false,
        message: 'You can only edit today\'s attendance'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Find existing attendance record
    const existingAttendance = await Attendance.findOne({
      classId: classId,
      date: date,
      facultyId: faculty._id
    });

    if (!existingAttendance) {
      return res.status(404).json({
        success: false,
        message: 'No attendance record found for this class and date. Please mark attendance first.'
      });
    }

    // Validate that all student IDs exist and belong to the class
    const studentIds = records.map(record => record.studentId);
    const students = await Student.find({
      _id: { $in: studentIds },
      status: 'active'
    }).select('_id rollNumber name email');

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more student IDs are invalid'
      });
    }

    // Create student lookup map
    const studentMap = {};
    students.forEach(student => {
      studentMap[student._id.toString()] = {
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email
      };
    });

    // Check for new OD records that need approval
    const updatedRecords = records.map(record => ({
      studentId: record.studentId,
      rollNumber: studentMap[record.studentId].rollNumber,
      name: studentMap[record.studentId].name,
      email: studentMap[record.studentId].email,
      status: record.status
    }));

    // Find records that are being changed to OD
    const newODRecords = updatedRecords.filter(record => {
      const existingRecord = existingAttendance.records.find(
        r => r.studentId.toString() === record.studentId.toString()
      );
      return record.status === 'od' && (!existingRecord || existingRecord.status !== 'od');
    });

    // Create approval requests for new OD records
    const approvalRequests = [];
    if (newODRecords.length > 0) {
      for (const odRecord of newODRecords) {
        const requestId = await generateRequestId('OD_REQUEST');
        const approvalRequest = new ApprovalRequest({
          requestId: requestId,
          type: 'OD_REQUEST',
          requestedBy: facultyId,
          requestedByRole: 'faculty',
          details: {
            studentId: odRecord.studentId,
            studentName: odRecord.name,
            studentRollNumber: odRecord.rollNumber,
            date: date,
            classId: classId,
            reason: `OD marked during attendance update for ${odRecord.name} (${odRecord.rollNumber})`,
            department: faculty.department
          },
          priority: 'medium'
        });
        await approvalRequest.save();
        approvalRequests.push(approvalRequest);
      }
    }

    // Mark new OD records as pending approval (keep previous status temporarily)
    const finalRecords = updatedRecords.map(record => {
      if (record.status === 'od') {
        const isNewOD = newODRecords.some(od => od.studentId.toString() === record.studentId.toString());
        if (isNewOD) {
          // Keep previous status temporarily, will be updated to OD after approval
          const existingRecord = existingAttendance.records.find(
            r => r.studentId.toString() === record.studentId.toString()
          );
          const previousStatus = existingRecord?.status || 'absent';
          
          return {
            ...record,
            status: previousStatus, // Keep previous status until approved
            pendingOD: true,
            odRequestId: approvalRequests.find(req => req.details.studentId.toString() === record.studentId.toString())?._id
          };
        }
      }
      return record;
    });

    // Recalculate totals
    const totalPresent = finalRecords.filter(r => r.status === 'present').length;
    const totalAbsent = finalRecords.filter(r => r.status === 'absent').length;
    const totalOD = finalRecords.filter(r => r.status === 'od').length;

    // Update the attendance record
    existingAttendance.records = finalRecords;
    existingAttendance.totalPresent = totalPresent;
    existingAttendance.totalAbsent = totalAbsent;
    existingAttendance.totalOD = totalOD;
    existingAttendance.status = newODRecords.length > 0 ? 'pending_od_approval' : 'modified';
    existingAttendance.notes = notes || existingAttendance.notes;
    existingAttendance.updatedBy = facultyId;

    await existingAttendance.save();

    // Response message
    const message = newODRecords.length > 0
      ? `Attendance updated successfully. ${newODRecords.length} OD request(s) sent for Principal approval.`
      : 'Attendance updated successfully';

    console.log('✅ Attendance record updated successfully:', {
      id: existingAttendance._id,
      totalStudents: existingAttendance.totalStudents,
      totalPresent: existingAttendance.totalPresent,
      totalAbsent: existingAttendance.totalAbsent
    });

    res.json({
      success: true,
      message: message,
      data: {
        attendance: existingAttendance,
        summary: {
          totalStudents: existingAttendance.totalStudents,
          totalPresent: existingAttendance.totalPresent,
          totalAbsent: existingAttendance.totalAbsent,
          totalOD: totalOD,
          pendingODApprovals: newODRecords.length,
          attendancePercentage: existingAttendance.attendancePercentage
        },
        approvalRequests: approvalRequests.map(req => ({
          id: req._id,
          requestId: req.requestId,
          studentId: req.details.studentId,
          status: req.status
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error updating attendance record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Create attendance record for a class and date
// @route   POST /api/attendance/:classId/:date
// @access  Faculty and above
router.post('/:classId/:date', authenticate, facultyAndAbove, [
  body('records').isArray().withMessage('Records must be an array'),
  body('records.*.studentId').isMongoId().withMessage('Invalid student ID'),
  body('records.*.status').isIn(['present', 'absent', 'od']).withMessage('Status must be present, absent, or od'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
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

    const { classId, date } = req.params;
    const { records, notes } = req.body;
    const facultyId = req.user._id;

    console.log('📝 Creating attendance record:', { classId, date, facultyId, recordsCount: records?.length });

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Check if date is today (only allow creating today's attendance)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (date !== todayStr) {
      return res.status(400).json({
        success: false,
        message: 'You can only create today\'s attendance'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Check if attendance already exists
    const existingAttendance = await Attendance.findOne({
      classId: classId,
      date: date,
      facultyId: faculty._id
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance record already exists for this class and date. Use PUT to update.'
      });
    }

    // Validate that all student IDs exist and belong to the class
    const studentIds = records.map(record => record.studentId);
    const students = await Student.find({
      _id: { $in: studentIds },
      status: 'active'
    }).select('_id rollNumber name email');

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more student IDs are invalid'
      });
    }

    // Create student lookup map
    const studentMap = {};
    students.forEach(student => {
      studentMap[student._id.toString()] = {
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email
      };
    });

    // Create attendance records
    const attendanceRecords = records.map(record => ({
      studentId: record.studentId,
      rollNumber: studentMap[record.studentId].rollNumber,
      name: studentMap[record.studentId].name,
      email: studentMap[record.studentId].email,
      status: record.status
    }));

    // Check if any records have OD status - these need approval
    const odRecords = attendanceRecords.filter(record => record.status === 'od');
    const nonODRecords = attendanceRecords.filter(record => record.status !== 'od');

    // Calculate totals
    const totalStudents = attendanceRecords.length;
    const totalPresent = attendanceRecords.filter(record => record.status === 'present').length;
    const totalAbsent = attendanceRecords.filter(record => record.status === 'absent').length;
    const totalOD = odRecords.length;

    console.log('📊 Calculated totals:', {
      totalStudents,
      totalPresent,
      totalAbsent,
      totalOD,
      recordsCount: attendanceRecords.length,
      odRecordsCount: odRecords.length
    });

    // If there are OD records, create approval requests for each
    const approvalRequests = [];
    if (odRecords.length > 0) {
      for (const odRecord of odRecords) {
        const requestId = await generateRequestId('OD_REQUEST');
        const approvalRequest = new ApprovalRequest({
          requestId: requestId,
          type: 'OD_REQUEST',
          requestedBy: facultyId,
          requestedByRole: 'faculty',
          details: {
            studentId: odRecord.studentId,
            studentName: odRecord.name,
            studentRollNumber: odRecord.rollNumber,
            date: date,
            classId: classId,
            reason: `OD marked during attendance for ${odRecord.name} (${odRecord.rollNumber})`,
            department: faculty.department
          },
          priority: 'medium'
        });
        await approvalRequest.save();
        approvalRequests.push(approvalRequest);
      }
    }

    // Create attendance records - mark OD records as 'absent' temporarily (will be updated after approval)
    const finalRecords = attendanceRecords.map(record => {
      if (record.status === 'od') {
        // Mark as absent temporarily, will be updated to OD after approval
        return {
          ...record,
          status: 'absent',
          pendingOD: true, // Flag to indicate this needs OD approval
          odRequestId: approvalRequests.find(req => req.details.studentId.toString() === record.studentId.toString())?._id
        };
      }
      return record;
    });

    // Recalculate totals with temporary status
    const finalTotalPresent = finalRecords.filter(record => record.status === 'present').length;
    const finalTotalAbsent = finalRecords.filter(record => record.status === 'absent').length;

    // Create new attendance record
    const attendance = new Attendance({
      classId: classId,
      date: date,
      facultyId: faculty._id,
      department: faculty.department,
      records: finalRecords,
      totalStudents: totalStudents,
      totalPresent: finalTotalPresent,
      totalAbsent: finalTotalAbsent,
      totalOD: 0, // Will be updated after approval
      status: odRecords.length > 0 ? 'pending_od_approval' : 'finalized',
      notes: notes || '',
      createdBy: facultyId,
      updatedBy: facultyId
    });

    console.log('📝 Created attendance object:', {
      classId: attendance.classId,
      date: attendance.date,
      totalStudents: attendance.totalStudents,
      totalPresent: attendance.totalPresent,
      totalAbsent: attendance.totalAbsent,
      recordsLength: attendance.records.length,
      pendingODCount: odRecords.length
    });

    await attendance.save();

    console.log('✅ Attendance record created successfully:', {
      id: attendance._id,
      totalStudents: attendance.totalStudents,
      totalPresent: attendance.totalPresent,
      totalAbsent: attendance.totalAbsent,
      odApprovalRequests: approvalRequests.length
    });

    // Response message based on whether OD approval is needed
    const message = odRecords.length > 0
      ? `Attendance created successfully. ${odRecords.length} OD request(s) sent for Principal approval.`
      : 'Attendance created successfully';

    res.status(201).json({
      success: true,
      message: message,
      data: {
        attendance: attendance,
        summary: {
          totalStudents: attendance.totalStudents,
          totalPresent: attendance.totalPresent,
          totalAbsent: attendance.totalAbsent,
          totalOD: totalOD,
          pendingODApprovals: odRecords.length,
          attendancePercentage: attendance.attendancePercentage
        },
        approvalRequests: approvalRequests.map(req => ({
          id: req._id,
          requestId: req.requestId,
          studentId: req.details.studentId,
          status: req.status
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error creating attendance record:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get attendance history for a class
// @route   GET /api/attendance/history
// @access  Faculty and above
router.get('/history', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { classId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const facultyId = req.user._id;

    console.log('📊 Getting attendance history:', { classId, startDate, endDate, facultyId });

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    // Validate date format if provided
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format. Use YYYY-MM-DD'
      });
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end date format. Use YYYY-MM-DD'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        success: false,
        message: 'Faculty not found or inactive'
      });
    }

    // Build query
    const query = { 
      facultyId: faculty._id, 
      classId: classId 
    };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = startDate;
      }
      if (endDate) {
        query.date.$lte = endDate;
      }
    }

    console.log('🔍 Query:', query);

    // First, get the actual students enrolled in this class
    const parts = classId.split('_');
    if (parts.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Invalid classId format. Expected: batch_year_semester_section'
      });
    }
    
    const [batch, year, semester, section] = parts;
    
    // Query students that have the specific semester enrollment (same as getStudentsForFaculty)
    const studentQuery = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': classId,
      'semesters.status': 'active',
      status: 'active'
    };

    console.log('🔍 Students query:', JSON.stringify(studentQuery, null, 2));

    const enrolledStudents = await Student.find(studentQuery)
      .select('_id rollNumber name email batch year semester section department')
      .sort({ rollNumber: 1 });

    console.log(`📊 Found ${enrolledStudents.length} enrolled students for class: ${classId}`);

    if (enrolledStudents.length === 0) {
      console.log('📭 No students enrolled in this class');
      return res.json({
        success: true,
        data: {
          records: [],
          enrolledStudents: [],
          pagination: {
            current: parseInt(page),
            pages: 0,
            total: 0,
            limit: parseInt(limit)
          }
        }
      });
    }

    // Get attendance records with pagination
    const attendanceRecords = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('records.studentId', 'rollNumber name email')
      .populate('createdBy updatedBy', 'name email');

    const total = await Attendance.countDocuments(query);

    console.log(`✅ Found ${attendanceRecords.length} attendance records`);

    // Transform records to match frontend expectations
    const transformedRecords = attendanceRecords.map(record => {
      const studentRecords = record.records.map(recordItem => {
        // Handle populated studentId
        const studentData = recordItem.studentId && typeof recordItem.studentId === 'object' 
          ? recordItem.studentId 
          : { rollNumber: recordItem.rollNumber, name: recordItem.name, email: recordItem.email };

        return {
          studentId: recordItem.studentId,
          rollNumber: studentData.rollNumber || recordItem.rollNumber,
          studentName: studentData.name || recordItem.name,
          name: studentData.name || recordItem.name, // Alias for compatibility
          email: studentData.email || recordItem.email || 'N/A',
          status: recordItem.status,
          remarks: recordItem.remarks || ''
        };
      });

      return {
        _id: record._id,
        date: record.date,
        status: record.status,
        totalStudents: enrolledStudents.length, // Use actual enrolled students count
        totalPresent: record.totalPresent,
        totalAbsent: record.totalAbsent,
        records: studentRecords,
        notes: record.notes,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    });

    // Transform enrolled students for frontend
    const enrolledStudentsData = enrolledStudents.map(student => ({
      studentId: student._id,
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email || 'N/A',
      batch: student.batch,
      year: student.year,
      semester: student.semester,
      section: student.section,
      department: student.department
    }));

    res.json({
      success: true,
      data: {
        records: transformedRecords,
        enrolledStudents: enrolledStudentsData,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get attendance history by class parameters (standardized format)
// @route   GET /api/attendance/history-by-class
// @access  Faculty and above
router.get('/history-by-class', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section, date } = req.query;
    const facultyId = req.user._id;

    console.log('📊 Getting attendance history by class:', { batch, year, semester, section, date, facultyId });

    if (!batch || !year || !semester || !section || !date) {
      return res.status(400).json({
        status: 'error',
        message: 'Batch, year, semester, section, and date are required'
      });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        status: 'error',
        message: 'Faculty not found or inactive'
      });
    }

    // Construct classId from parameters
    const classId = `${batch}_${year}_${semester}_${section}`;
    
    // Parse the date and normalize to UTC midnight
    const attendanceDate = new Date(date);
    const normalizedDate = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate());
    
    console.log('📅 Date processing:', {
      originalDate: date,
      parsedDate: attendanceDate,
      normalizedDate: normalizedDate
    });

    // Query ClassAttendance model first (primary storage)
    let attendanceRecord = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classAssigned: classId,
      department: faculty.department,
      date: normalizedDate
    });
    
    // If not found, try with date range query (timezone issues)
    if (!attendanceRecord) {
      const startOfDay = new Date(normalizedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(normalizedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      
      attendanceRecord = await ClassAttendance.findOne({
        facultyId: faculty._id,
        classAssigned: classId,
        department: faculty.department,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
    }
    
    // If still not found, try the Attendance model as fallback
    let attendanceModelRecord = null;
    if (!attendanceRecord) {
      console.log('📅 Trying Attendance model as fallback...');
      attendanceModelRecord = await Attendance.findOne({
        facultyId: faculty._id,
        classId: classId,
        date: date
      });
      
      if (attendanceModelRecord) {
        console.log('📅 Found record in Attendance model, converting format');
        // Convert Attendance model record to ClassAttendance format
        attendanceRecord = {
          presentStudents: attendanceModelRecord.records.filter(r => r.status === 'present').map(r => r.rollNumber),
          absentStudents: attendanceModelRecord.records.filter(r => r.status === 'absent').map(r => r.rollNumber),
          odStudents: attendanceModelRecord.records.filter(r => r.status === 'od').map(r => r.rollNumber),
          totalStudents: attendanceModelRecord.totalStudents,
          totalPresent: attendanceModelRecord.totalPresent,
          totalAbsent: attendanceModelRecord.totalAbsent,
          totalOD: attendanceModelRecord.totalOD || 0,
          date: normalizedDate,
          updatedAt: attendanceModelRecord.updatedAt,
          status: attendanceModelRecord.status,
          _rawRecords: attendanceModelRecord.records // Keep raw records for reason lookup
        };
      }
    } else {
      // Even if found in ClassAttendance, try to get the Attendance model for reasons
      attendanceModelRecord = await Attendance.findOne({
        facultyId: faculty._id,
        classId: classId,
        date: date
      });
      
      if (attendanceModelRecord) {
        attendanceRecord._rawRecords = attendanceModelRecord.records;
        // Also add odStudents array if not already present in attendanceRecord
        if (!attendanceRecord.odStudents) {
          attendanceRecord.odStudents = attendanceModelRecord.records.filter(r => r.status === 'od').map(r => r.rollNumber);
        }
      }
    }

    console.log('📋 Attendance record found:', !!attendanceRecord);

    // Get all students in the class for reference
    const studentQuery = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': classId,
      'semesters.status': 'active',
      status: 'active'
    };

    const enrolledStudents = await Student.find(studentQuery)
      .select('_id rollNumber name email')
      .sort({ rollNumber: 1 });

    console.log(`📊 Found ${enrolledStudents.length} enrolled students`);

    // Create standardized attendance records for each student
    const attendanceRecords = enrolledStudents.map(student => {
      const isPresent = attendanceRecord?.presentStudents?.includes(student.rollNumber) || false;
      const isAbsent = attendanceRecord?.absentStudents?.includes(student.rollNumber) || false;
      const isOD = attendanceRecord?.odStudents?.includes(student.rollNumber) || false;
      
      let status = 'Not Marked';
      let remarks = '-';
      let markedBy = '-';
      let timestamp = '-';
      
      // Look for the student's record in raw records to get the reason and actual status
      let studentRecord = null;
      if (attendanceRecord?._rawRecords) {
        studentRecord = attendanceRecord._rawRecords.find(r => r.rollNumber === student.rollNumber);
        // Check the actual status from the raw record if available
        if (studentRecord && studentRecord.status) {
          const recordStatus = studentRecord.status.toLowerCase();
          if (recordStatus === 'od' || recordStatus === 'onduty') {
            status = 'OD';
            remarks = studentRecord.reason || '-';
            markedBy = faculty.name || 'Faculty';
            timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
          } else if (recordStatus === 'present') {
            status = 'Present';
            remarks = '-';
            markedBy = faculty.name || 'Faculty';
            timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
          } else if (recordStatus === 'absent') {
            status = 'Absent';
            remarks = studentRecord.reason || '-';
            markedBy = faculty.name || 'Faculty';
            timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
          }
        }
      }
      
      // Fallback to list-based check if raw record doesn't have status
      if (status === 'Not Marked') {
        if (isOD) {
          status = 'OD';
          remarks = studentRecord?.reason || '-';
          markedBy = faculty.name || 'Faculty';
          timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
        } else if (isPresent) {
          status = 'Present';
          remarks = '-';
          markedBy = faculty.name || 'Faculty';
          timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
        } else if (isAbsent) {
          status = 'Absent';
          // Check if student submitted a reason
          remarks = studentRecord?.reason || '-';
          markedBy = faculty.name || 'Faculty';
          timestamp = attendanceRecord?.updatedAt ? new Date(attendanceRecord.updatedAt).toISOString() : new Date().toISOString();
        }
      }

      return {
        rollNo: student.rollNumber,
        name: student.name,
        email: student.email || 'N/A',
        date: date,
        status: status,
        remarks: remarks,
        markedBy: markedBy,
        timestamp: timestamp,
        reviewStatus: studentRecord?.reviewStatus || null,
        facultyNote: studentRecord?.facultyNote || null
      };
    });

    console.log('✅ Processed attendance records:', attendanceRecords.length);

    // Return standardized response format
    res.json({
      status: 'success',
      data: attendanceRecords,
      summary: {
        totalStudents: attendanceRecord?.totalStudents || enrolledStudents.length,
        totalPresent: attendanceRecord?.totalPresent || 0,
        totalAbsent: attendanceRecord?.totalAbsent || 0,
        totalOD: attendanceRecord?.totalOD || 0,
        attendancePercentage: attendanceRecord?.attendancePercentage || 0
      }
    });

  } catch (error) {
    console.error('❌ Error getting attendance history by class:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @desc    Get attendance history by date range with analytics (UNIFIED LOGIC)
// @route   GET /api/attendance/history-range
// @access  Faculty and above
router.get('/history-range', authenticate, facultyAndAbove, async (req, res) => {
  try {
    const { batch, year, semester, section, startDate, endDate, viewMode = 'weekly' } = req.query;
    const facultyId = req.user._id;

    console.log('📊 Getting attendance history by range (UNIFIED LOGIC):', { batch, year, semester, section, startDate, endDate, viewMode, facultyId });

    if (!batch || !year || !semester || !section || !startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Batch, year, semester, section, start date, and end date are required'
      });
    }

    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Get faculty
    const faculty = await Faculty.findOne({
      userId: facultyId,
      status: 'active'
    });

    if (!faculty) {
      return res.status(403).json({
        status: 'error',
        message: 'Faculty not found or inactive'
      });
    }

    // Construct classId from parameters
    const classId = `${batch}_${year}_${semester}_${section}`;
    
    console.log('📅 UNIFIED LOGIC - Processing date range:', {
      startDate,
      endDate,
      classId,
      viewMode
    });

    // Get all students in the class (same as single-date logic)
    const studentQuery = {
      department: faculty.department,
      batchYear: batch,
      section: section,
      'semesters.semesterName': semester,
      'semesters.year': year,
      'semesters.classId': classId,
      'semesters.status': 'active',
      status: 'active'
    };

    const enrolledStudents = await Student.find(studentQuery)
      .select('_id rollNumber name email')
      .sort({ rollNumber: 1 });

    console.log(`📊 Found ${enrolledStudents.length} enrolled students`);

    if (enrolledStudents.length === 0) {
      return res.json({
        status: 'success',
        data: {
          students: [],
          workingDays: [],
          analytics: {
            totalStudents: 0,
            totalWorkingDays: 0,
            averageAttendance: 0,
            highestAttendance: { name: '', percentage: 0 },
            lowestAttendance: { name: '', percentage: 0 }
          }
        }
      });
    }

    // Get holidays for the date range
    const holidayResult = await getHolidayCountForAnalytics({
      batchYear: batch,
      section: section,
      semester: semester,
      department: faculty.department,
      startDate: startDate,
      endDate: endDate
    });

    const holidays = holidayResult.success ? holidayResult.data.holidays : [];
    const holidayDates = new Set(holidays.map(h => h.date));

    // Generate working days array (INCLUSIVE) - excluding holidays
    const workingDays = [];
    const startDateForLoop = new Date(startDate + 'T00:00:00.000Z');
    const endDateForLoop = new Date(endDate + 'T00:00:00.000Z');
    
    const currentDate = new Date(startDateForLoop);
    while (currentDate <= endDateForLoop) {
      const dateStr = currentDate.toISOString().split('T')[0];
      // Skip weekends and holidays
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
        workingDays.push(dateStr);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    console.log('📅 Generated working days (UNIFIED):', {
      totalDays: workingDays.length,
      firstDay: workingDays[0],
      lastDay: workingDays[workingDays.length - 1],
      allDays: workingDays
    });

    // UNIFIED LOGIC: Use the same proven logic as single-date endpoint
    // For each day in the range, fetch attendance using the same logic as history-by-class
    const dailyAttendanceData = {};
    
    for (const dateStr of workingDays) {
      console.log(`📅 Processing date: ${dateStr}`);
      
      // Parse the date and normalize to UTC midnight (same as single-date logic)
      const attendanceDate = new Date(dateStr);
      const normalizedDate = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate());
      
      // Query ClassAttendance model first (same as single-date logic)
      let attendanceRecord = await ClassAttendance.findOne({
      facultyId: faculty._id,
      classAssigned: classId,
      department: faculty.department,
        date: normalizedDate
      });
      
      // If not found, try with date range query (same as single-date logic)
      if (!attendanceRecord) {
        const startOfDay = new Date(normalizedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(normalizedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        attendanceRecord = await ClassAttendance.findOne({
          facultyId: faculty._id,
          classAssigned: classId,
          department: faculty.department,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });
      }
      
      // If still not found, try the Attendance model as fallback (same as single-date logic)
      if (!attendanceRecord) {
        const attendanceModelRecord = await Attendance.findOne({
        facultyId: faculty._id,
        classId: classId,
          date: dateStr
        });
        
        if (attendanceModelRecord) {
          // Convert Attendance model record to ClassAttendance format (same as single-date logic)
          attendanceRecord = {
            presentStudents: attendanceModelRecord.records.filter(r => r.status === 'present').map(r => r.rollNumber),
            absentStudents: attendanceModelRecord.records.filter(r => r.status === 'absent').map(r => r.rollNumber),
            odStudents: attendanceModelRecord.records.filter(r => r.status === 'od').map(r => r.rollNumber),
            totalStudents: attendanceModelRecord.totalStudents,
            totalPresent: attendanceModelRecord.totalPresent,
            totalAbsent: attendanceModelRecord.totalAbsent,
            totalOD: attendanceModelRecord.totalOD || 0,
            date: normalizedDate,
            updatedAt: attendanceModelRecord.updatedAt,
            status: attendanceModelRecord.status
          };
        }
      }
      
      // Store the attendance record for this date
      if (attendanceRecord) {
        dailyAttendanceData[dateStr] = attendanceRecord;
        console.log(`✅ Found attendance for ${dateStr}:`, {
          totalStudents: attendanceRecord.totalStudents,
          totalPresent: attendanceRecord.totalPresent,
          presentStudents: attendanceRecord.presentStudents?.length || 0
        });
      } else {
        console.log(`⚠️ No attendance found for ${dateStr}`);
      }
    }

    console.log(`📋 Processed ${Object.keys(dailyAttendanceData).length} days with attendance data`);

    // Create student attendance data using the same logic as single-date
    const studentAttendanceData = enrolledStudents.map(student => {
      const attendanceData = {};
      let presentCount = 0;
      let totalWorkingDays = 0;

      // Initialize all working days as 'Not Marked
      workingDays.forEach(date => {
        attendanceData[date] = 'Not Marked';
      });

      // Fill in actual attendance data using the same logic as single-date
      workingDays.forEach(dateStr => {
        const attendanceRecord = dailyAttendanceData[dateStr];
        
        if (attendanceRecord) {
          totalWorkingDays++;
          
          const isPresent = attendanceRecord.presentStudents?.includes(student.rollNumber) || false;
          const isAbsent = attendanceRecord.absentStudents?.includes(student.rollNumber) || false;
          const isOD = attendanceRecord.odStudents?.includes(student.rollNumber) || false;
          
          if (isOD) {
            attendanceData[dateStr] = 'OD';
            presentCount++; // OD is considered as present
          } else if (isPresent) {
            attendanceData[dateStr] = 'Present';
            presentCount++;
          } else if (isAbsent) {
            attendanceData[dateStr] = 'Absent';
          }
        }
      });

      const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100 * 100) / 100 : 0;

      return {
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email || 'N/A',
        attendanceData: attendanceData,
        presentCount: presentCount,
        totalWorkingDays: totalWorkingDays,
        attendancePercentage: attendancePercentage
      };
    });

    // Calculate analytics (same logic as before)
    const totalStudents = enrolledStudents.length;
    const totalWorkingDays = workingDays.length;
    
    const attendancePercentages = studentAttendanceData
      .filter(student => student.totalWorkingDays > 0)
      .map(student => student.attendancePercentage);
    
    const averageAttendance = attendancePercentages.length > 0 
      ? Math.round(attendancePercentages.reduce((sum, pct) => sum + pct, 0) / attendancePercentages.length * 100) / 100 
      : 0;

    const sortedByAttendance = studentAttendanceData
      .filter(student => student.totalWorkingDays > 0)
      .sort((a, b) => b.attendancePercentage - a.attendancePercentage);

    const highestAttendance = sortedByAttendance.length > 0 
      ? { name: sortedByAttendance[0].name, percentage: sortedByAttendance[0].attendancePercentage }
      : { name: '', percentage: 0 };

    const lowestAttendance = sortedByAttendance.length > 0 
      ? { name: sortedByAttendance[sortedByAttendance.length - 1].name, percentage: sortedByAttendance[sortedByAttendance.length - 1].attendancePercentage }
      : { name: '', percentage: 0 };

    console.log('✅ UNIFIED LOGIC - Processed attendance range data:', {
      totalStudents,
      totalWorkingDays,
      averageAttendance,
      daysWithAttendance: Object.keys(dailyAttendanceData).length,
      workingDays: workingDays.length
    });

    // Return standardized response format
    res.json({
      status: 'success',
      data: {
        students: studentAttendanceData,
        workingDays: workingDays,
        holidays: holidays,
        analytics: {
          totalStudents,
          totalWorkingDays,
          holidayCount: holidays.length,
          averageAttendance,
          highestAttendance,
          lowestAttendance
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting attendance history by range:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

export default router;
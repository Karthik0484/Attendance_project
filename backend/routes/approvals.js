import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import User from '../models/User.js';
import DepartmentHODMapping from '../models/DepartmentHODMapping.js';
import DepartmentSettings from '../models/DepartmentSettings.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import Notification from '../models/Notification.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import ClassAssignment from '../models/ClassAssignment.js';
import mongoose from 'mongoose';

const router = express.Router();

// Helper function to generate unique requestId for ApprovalRequest
async function generateRequestId(type) {
  const prefix = type.substring(0, 3).toUpperCase();
  const count = await ApprovalRequest.countDocuments({ type: type });
  return `${prefix}-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
}

// All routes require authentication
router.use(authenticate);

// ==================== SUBMISSION ROUTES (Faculty, HOD, Admin) ====================

// @desc    Submit HOD Change Request
// @route   POST /api/approvals/hod-change
// @access  Admin, Principal
router.post('/approvals/hod-change', [
  body('department').notEmpty().withMessage('Department is required'),
  body('action').isIn(['assign', 'replace', 'remove']).withMessage('Invalid action'),
  body('newHOD').optional().notEmpty().withMessage('New HOD ID is required for assign/replace'),
  body('oldHOD').optional().notEmpty().withMessage('Old HOD ID is required for replace/remove'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { department, action, newHOD, oldHOD, reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only admin and principal can submit
    if (!['admin', 'principal'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        msg: 'You do not have permission to submit HOD change requests'
      });
    }

    // Validate action requirements
    if ((action === 'assign' || action === 'replace') && !newHOD) {
      return res.status(400).json({
        success: false,
        msg: 'New HOD ID is required for assign/replace actions'
      });
    }

    if ((action === 'replace' || action === 'remove') && !oldHOD) {
      return res.status(400).json({
        success: false,
        msg: 'Old HOD ID is required for replace/remove actions'
      });
    }

    const requestId = await generateRequestId('HOD_CHANGE');
    const request = new ApprovalRequest({
      requestId: requestId,
      type: 'HOD_CHANGE',
      requestedBy: userId,
      requestedByRole: userRole,
      details: {
        department,
        action,
        newHOD: newHOD || null,
        oldHOD: oldHOD || null,
        reason
      },
      priority: 'high'
    });

    await request.save();

    res.status(201).json({
      success: true,
      msg: 'HOD change request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error submitting HOD change request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error submitting HOD change request',
      error: error.message
    });
  }
});

// ==================== SUBMISSION ROUTES (Faculty, HOD, Admin) ====================

// @desc    Submit OD Request (Future dates only)
// @route   POST /api/approvals/od-request
// @access  Faculty, HOD
router.post('/approvals/od-request', [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters')
], async (req, res) => {
  // Check if user is faculty or HOD
  if (!['faculty', 'hod'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      msg: 'Only faculty and HOD can submit OD requests'
    });
  }
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { studentId, date, reason, attachments, classId } = req.body;
    const facultyId = req.user._id;

    // Validate reason length (backend enforcement)
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length < 10) {
      return res.status(400).json({
        success: false,
        msg: 'Reason must be provided with at least 10 characters'
      });
    }

    // Validate date is in the future (minimum +1 day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const odDate = new Date(date);
    odDate.setHours(0, 0, 0, 0);
    
    const diffTime = odDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      return res.status(400).json({
        success: false,
        msg: 'OD must be requested at least one day before the OD date. Same-day and past dates are not allowed.'
      });
    }

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        msg: 'Student not found'
      });
    }

    // Verify faculty has access to this student (same department)
    const faculty = await Faculty.findOne({ userId: facultyId, status: 'active' });
    if (!faculty) {
      return res.status(403).json({
        success: false,
        msg: 'Faculty not found or inactive'
      });
    }

    if (student.department !== faculty.department) {
      return res.status(403).json({
        success: false,
        msg: 'You can only submit OD requests for students in your department'
      });
    }

    // Check if there's already a pending OD request for this student on this date
    const existingRequest = await ApprovalRequest.findOne({
      type: 'OD_REQUEST',
      status: 'pending',
      'details.studentId': studentId,
      'details.date': odDate.toISOString().split('T')[0],
      requestedBy: facultyId
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        msg: 'A pending OD request already exists for this student on this date'
      });
    }

    // Get student's class information if classId is provided
    let studentClassId = classId;
    if (!studentClassId && student.semesters && student.semesters.length > 0) {
      const activeSemester = student.semesters.find(s => s.status === 'active');
      if (activeSemester && activeSemester.classId) {
        studentClassId = activeSemester.classId;
      }
    }
    
    // Normalize classId - convert ObjectId to string format if needed
    if (studentClassId) {
      // Check if it's an ObjectId
      if (mongoose.Types.ObjectId.isValid(studentClassId) && studentClassId.toString().length === 24 && !studentClassId.includes('_')) {
        // Fetch class assignment to get proper format
        const classAssignment = await ClassAssignment.findById(studentClassId);
        if (classAssignment) {
          studentClassId = `${classAssignment.batch}_${classAssignment.year}_${classAssignment.semester}_${classAssignment.section}`;
          console.log('🔄 Normalized classId for OD request:', { original: activeSemester?.classId, normalized: studentClassId });
        }
      }
    }

    // Generate request ID and create approval request
    const requestId = await generateRequestId('OD_REQUEST');
    const request = new ApprovalRequest({
      requestId: requestId,
      type: 'OD_REQUEST',
      requestedBy: facultyId,
      requestedByRole: req.user.role,
      details: {
        studentId,
        studentName: student.name,
        studentRollNumber: student.rollNumber,
        date: odDate.toISOString().split('T')[0],
        classId: studentClassId || null,
        reason: trimmedReason,
        department: student.department,
        isFutureOD: true // Flag to indicate this is a future date OD
      },
      attachments: attachments || [],
      priority: 'medium'
    });

    await request.save();

    // Send notification to Principal
    try {
      const Notification = (await import('../models/Notification.js')).default;
      await Notification.create({
        type: 'system',
        title: 'New OD Request',
        message: `OD request submitted for ${student.name} (${student.rollNumber}) on ${odDate.toISOString().split('T')[0]}`,
        department: student.department,
        priority: 'medium',
        sentBy: facultyId,
        actionUrl: `/principal/approvals`
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the request if notification fails
    }

    console.log('✅ OD Request submitted:', {
      requestId: request.requestId,
      studentId,
      studentName: student.name,
      date: odDate.toISOString().split('T')[0],
      reason: trimmedReason.substring(0, 50) + '...',
      daysInAdvance: diffDays
    });

    res.status(201).json({
      success: true,
      msg: 'OD request submitted successfully. Waiting for Principal approval.',
      data: {
        requestId: request.requestId,
        studentName: student.name,
        date: odDate.toISOString().split('T')[0],
        daysInAdvance: diffDays
      }
    });
  } catch (error) {
    console.error('Error submitting OD request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error submitting OD request',
      error: error.message
    });
  }
});

// @desc    Submit Faculty Holiday Request
// @route   POST /api/approvals/holiday-request
// @access  Faculty, HOD, Admin
router.post('/approvals/holiday-request', [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('scope').isIn(['class', 'department', 'global']).withMessage('Invalid scope'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { date, department, scope, reason, classDetails, attachments } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only faculty, HOD, and admin can submit
    if (!['faculty', 'hod', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        msg: 'You do not have permission to submit holiday requests'
      });
    }

    const requestId = await generateRequestId('FACULTY_HOLIDAY_REQUEST');
    const request = new ApprovalRequest({
      requestId: requestId,
      type: 'FACULTY_HOLIDAY_REQUEST',
      requestedBy: userId,
      requestedByRole: userRole,
      details: {
        date,
        department,
        scope,
        reason,
        classDetails: classDetails || null
      },
      attachments: attachments || [],
      priority: scope === 'global' ? 'high' : 'medium'
    });

    await request.save();

    res.status(201).json({
      success: true,
      msg: 'Holiday request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error submitting holiday request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error submitting holiday request',
      error: error.message
    });
  }
});

// @desc    Submit Attendance Edit Request
// @route   POST /api/approvals/attendance-edit
// @access  Faculty, HOD
router.post('/approvals/attendance-edit', [
  body('attendanceId').notEmpty().withMessage('Attendance ID is required'),
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('originalStatus').notEmpty().withMessage('Original status is required'),
  body('newStatus').notEmpty().withMessage('New status is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { attendanceId, studentId, date, originalStatus, newStatus, reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only faculty and HOD can submit
    if (!['faculty', 'hod'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        msg: 'You do not have permission to submit attendance edit requests'
      });
    }

    const requestId = await generateRequestId('ATTENDANCE_EDIT');
    const request = new ApprovalRequest({
      requestId: requestId,
      type: 'ATTENDANCE_EDIT',
      requestedBy: userId,
      requestedByRole: userRole,
      details: {
        attendanceId,
        studentId,
        date,
        originalStatus,
        newStatus,
        reason
      },
      priority: 'high'
    });

    await request.save();

    res.status(201).json({
      success: true,
      msg: 'Attendance edit request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error submitting attendance edit request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error submitting attendance edit request',
      error: error.message
    });
  }
});

// @desc    Submit Leave Exception Request
// @route   POST /api/approvals/leave-exception
// @access  Faculty only
router.post('/approvals/leave-exception', [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('correction').notEmpty().withMessage('Correction details are required'),
  body('reason').trim().notEmpty().withMessage('Reason is required')
], async (req, res) => {
  // Check if user is faculty
  if (req.user.role !== 'faculty') {
    return res.status(403).json({
      success: false,
      msg: 'Only faculty can submit leave exception requests'
    });
  }
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }

    const { date, correction, reason } = req.body;
    const facultyId = req.user._id;

    const requestId = await generateRequestId('LEAVE_EXCEPTION');
    const request = new ApprovalRequest({
      requestId: requestId,
      type: 'LEAVE_EXCEPTION',
      requestedBy: facultyId,
      requestedByRole: 'faculty',
      details: {
        facultyId,
        date,
        correction,
        reason,
        department: req.user.department
      },
      priority: 'medium'
    });

    await request.save();

    res.status(201).json({
      success: true,
      msg: 'Leave exception request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error submitting leave exception request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error submitting leave exception request',
      error: error.message
    });
  }
});

// ==================== PRINCIPAL ROUTES ====================

// @desc    Get dashboard metrics
// @route   GET /api/principal/approvals/metrics
// @access  Principal only
router.get('/principal/approvals/metrics', authorize('principal'), async (req, res) => {
  try {
    const metrics = await ApprovalRequest.getDashboardMetrics();
    const pendingCounts = await ApprovalRequest.getPendingCounts();
    
    res.status(200).json({
      success: true,
      data: {
        ...metrics,
        pendingByType: pendingCounts
      }
    });
  } catch (error) {
    console.error('Error fetching approval metrics:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching approval metrics',
      error: error.message
    });
  }
});

// @desc    Get all pending approval requests
// @route   GET /api/principal/approvals/pending
// @access  Principal only
router.get('/principal/approvals/pending', authorize('principal'), async (req, res) => {
  try {
    const { type, priority } = req.query;
    
    const query = { status: 'pending' };
    if (type) query.type = type;
    if (priority) query.priority = priority;
    
    const requests = await ApprovalRequest.find(query)
      .populate('requestedBy', 'name email department role')
      .sort({ priority: -1, requestedOn: -1 })
      .limit(100);
    
    res.status(200).json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching pending approvals',
      error: error.message
    });
  }
});

// @desc    Get approval history
// @route   GET /api/principal/approvals/history
// @access  Principal only
router.get('/principal/approvals/history', authorize('principal'), async (req, res) => {
  try {
    const { type, status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { status: { $in: ['approved', 'rejected'] } };
    if (type) query.type = type;
    if (status) query.status = status;
    
    const [requests, total] = await Promise.all([
      ApprovalRequest.find(query)
        .populate('requestedBy', 'name email department role')
        .populate('approval.approvedBy', 'name email')
        .populate('approval.rejectedBy', 'name email')
        .sort({ 'approval.approvedOn': -1, 'approval.rejectedOn': -1, requestedOn: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ApprovalRequest.countDocuments(query)
    ]);
    
    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching approval history',
      error: error.message
    });
  }
});

// @desc    Get single approval request details
// @route   GET /api/principal/approvals/:id
// @access  Principal only
router.get('/principal/approvals/:id', authorize('principal'), async (req, res) => {
  try {
    const request = await ApprovalRequest.findById(req.params.id)
      .populate('requestedBy', 'name email department role mobile')
      .populate('approval.approvedBy', 'name email')
      .populate('approval.rejectedBy', 'name email')
      .populate('auditLog.performedBy', 'name email role');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        msg: 'Approval request not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error fetching approval request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching approval request',
      error: error.message
    });
  }
});

// @desc    Approve a request
// @route   POST /api/principal/approvals/:id/approve
// @access  Principal only
router.post('/principal/approvals/:id/approve', authorize('principal'), [
  body('remarks').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { remarks } = req.body;
    const principalId = req.user._id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const request = await ApprovalRequest.findById(req.params.id)
      .populate('requestedBy', 'name email department role');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        msg: 'Approval request not found'
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        msg: `Request is already ${request.status}`
      });
    }
    
    // Process approval based on request type
    let approvalResult = {};
    
    try {
      switch (request.type) {
        case 'HOD_CHANGE':
          approvalResult = await approveHODChange(request, principalId);
          break;
        case 'OD_REQUEST':
          approvalResult = await approveODRequest(request, principalId);
          break;
        case 'SPECIAL_HOLIDAY':
        case 'FACULTY_HOLIDAY_REQUEST':
          approvalResult = await approveHolidayRequest(request, principalId);
          break;
        case 'LEAVE_EXCEPTION':
          approvalResult = await approveLeaveException(request, principalId);
          break;
        case 'ATTENDANCE_EDIT':
          approvalResult = await approveAttendanceEdit(request, principalId);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }
      
      // Update request status
      request.status = 'approved';
      request.approval = {
        approvedBy: principalId,
        approvedOn: new Date(),
        remarks: remarks || '',
        ipAddress
      };
      
      // Add audit log
      await request.addAuditLog(
        'APPROVED',
        principalId,
        { status: 'pending' },
        { status: 'approved', ...approvalResult },
        remarks || 'Request approved',
        ipAddress
      );
      
      await request.save();
      
      // Send notifications
      await sendApprovalNotification(request, 'approved', approvalResult);
      
      res.status(200).json({
        success: true,
        msg: 'Request approved successfully',
        data: {
          request: request.toObject(),
          approvalResult
        }
      });
    } catch (approvalError) {
      console.error('Error processing approval:', approvalError);
      
      // Add audit log for failed approval
      await request.addAuditLog(
        'APPROVAL_FAILED',
        principalId,
        { status: 'pending' },
        { error: approvalError.message },
        `Approval failed: ${approvalError.message}`,
        ipAddress
      );
      
      throw approvalError;
    }
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error approving request',
      error: error.message
    });
  }
});

// @desc    Reject a request
// @route   POST /api/principal/approvals/:id/reject
// @access  Principal only
router.post('/principal/approvals/:id/reject', authorize('principal'), [
  body('remarks').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        msg: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { remarks } = req.body;
    const principalId = req.user._id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const request = await ApprovalRequest.findById(req.params.id)
      .populate('requestedBy', 'name email department role');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        msg: 'Approval request not found'
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        msg: `Request is already ${request.status}`
      });
    }
    
    // Update request status
    request.status = 'rejected';
    request.approval = {
      rejectedBy: principalId,
      rejectedOn: new Date(),
      remarks: remarks || 'Request rejected',
      ipAddress
    };
    
    // Add audit log
    await request.addAuditLog(
      'REJECTED',
      principalId,
      { status: 'pending' },
      { status: 'rejected' },
      remarks || 'Request rejected',
      ipAddress
    );
    
    await request.save();
    
    // Send notifications
    await sendApprovalNotification(request, 'rejected', { remarks: remarks || 'Request rejected' });
    
    res.status(200).json({
      success: true,
      msg: 'Request rejected successfully',
      data: request
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({
      success: false,
      msg: 'Error rejecting request',
      error: error.message
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

// Approve HOD Change Request
async function approveHODChange(request, principalId) {
  const { department, newHOD, oldHOD, action } = request.details;
  
  // Handle old HOD deactivation for replace/remove actions
  if ((action === 'replace' || action === 'remove') && oldHOD) {
    const oldHODUser = await User.findById(oldHOD);
    if (oldHODUser) {
      oldHODUser.status = 'inactive';
      oldHODUser.accessLevel = 'restricted';
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      oldHODUser.expiryDate = expiryDate;
      await oldHODUser.save();
      
      // Deactivate old mapping
      const oldMapping = await DepartmentHODMapping.findOne({
        departmentId: department,
        hodId: oldHOD,
        status: 'active'
      });
      if (oldMapping) {
        await oldMapping.deactivate(principalId, `${action === 'replace' ? 'Replaced' : 'Removed'} via approval`);
      }
    }
  }
  
  // Handle new HOD assignment for assign/replace actions
  if ((action === 'assign' || action === 'replace') && newHOD) {
    // Verify new HOD user exists
    const newHODUser = await User.findById(newHOD);
    if (!newHODUser || newHODUser.role !== 'hod') {
      throw new Error('Invalid HOD user specified');
    }
    
    // Check if department already has an active HOD (for assign action)
    if (action === 'assign') {
      const existingMapping = await DepartmentHODMapping.findOne({
        departmentId: department,
        status: 'active'
      });
      if (existingMapping) {
        throw new Error(`Department ${department} already has an active HOD. Use replace action instead.`);
      }
    }
    
    // Create new HOD mapping
    const newMapping = new DepartmentHODMapping({
      departmentId: department,
      hodId: newHOD,
      assignedBy: principalId,
      createdByRole: 'principal',
      status: 'active',
      notes: `Approved via approval request: ${request.requestId}`
    });
    await newMapping.save();
    
    // Update department settings
    let deptSettings = await DepartmentSettings.findOne({ department });
    if (!deptSettings) {
      deptSettings = new DepartmentSettings({ department });
    }
    deptSettings.hodId = newHOD;
    await deptSettings.save();
    
    // Ensure new HOD user is active
    newHODUser.status = 'active';
    newHODUser.accessLevel = 'full';
    newHODUser.expiryDate = null;
    await newHODUser.save();
  }
  
  // Handle remove action (no new HOD)
  if (action === 'remove') {
    const deptSettings = await DepartmentSettings.findOne({ department });
    if (deptSettings) {
      deptSettings.hodId = null;
      await deptSettings.save();
    }
  }
  
  return { department, action, newHOD, oldHOD };
}

// Approve OD Request
async function approveODRequest(request, principalId) {
  const { studentId, date, classId, reason, isFutureOD, department } = request.details;
  
  // Normalize date to YYYY-MM-DD format
  let attendanceDate;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    attendanceDate = date;
  } else {
    attendanceDate = new Date(date).toISOString().split('T')[0];
  }
  
  console.log('🔍 Approving OD Request:', {
    studentId,
    date: attendanceDate,
    classId,
    isFutureOD,
    requestId: request._id
  });
  
  // Get student details
  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }
  
  // Get faculty who requested (for future ODs, we need a faculty to create attendance)
  const requestedBy = request.requestedBy._id || request.requestedBy;
  const faculty = await Faculty.findOne({ userId: requestedBy, status: 'active' });
  if (!faculty) {
    throw new Error(`Faculty not found for user: ${requestedBy}`);
  }
  
  // Normalize classId - handle both ObjectId and string format
  let normalizedClassId = classId;
  let batch, year, semester, section;
  
  // Check if classId is a MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(classId) && classId.toString().length === 24 && !classId.includes('_')) {
    // It's an ObjectId, fetch the class assignment to get the proper format
    const classAssignment = await ClassAssignment.findById(classId);
    if (!classAssignment) {
      throw new Error(`Class assignment not found for classId: ${classId}`);
    }
    
    // Construct the normalized classId from class assignment
    normalizedClassId = `${classAssignment.batch}_${classAssignment.year}_${classAssignment.semester}_${classAssignment.section}`;
    batch = classAssignment.batch;
    year = classAssignment.year;
    semester = classAssignment.semester;
    section = classAssignment.section;
    
    console.log('🔄 Converted ObjectId to classId format:', { original: classId, normalized: normalizedClassId });
  } else {
    // It's already in the string format (batch_year_semester_section)
    const classParts = classId.split('_');
    if (classParts.length !== 4) {
      throw new Error(`Invalid classId format: ${classId}. Expected format: batch_year_semester_section or valid ObjectId`);
    }
    [batch, year, semester, section] = classParts;
  }
  
  // Find or create attendance record using normalized classId
  let attendance = await Attendance.findOne({ 
    classId: normalizedClassId,
    date: attendanceDate 
  });
  
  const studentIdStr = studentId.toString();
  
  if (!attendance) {
    // For future ODs, create a new attendance record
    if (isFutureOD) {
      console.log('📅 Creating new attendance record for future OD:', { classId: normalizedClassId, date: attendanceDate });
      
      // Find all students in this class
      const studentsInClass = await Student.find({
        department: department || student.department,
        batchYear: batch,
        section: section,
        'semesters.semesterName': semester,
        'semesters.year': year,
        'semesters.status': 'active',
        status: 'active'
      }).select('_id rollNumber name email');
      
      // Create records for all students
      const records = studentsInClass.map(s => {
        if (s._id.toString() === studentIdStr) {
          // Mark the requested student as OD
          return {
            studentId: s._id,
            rollNumber: s.rollNumber,
            name: s.name,
            email: s.email,
            status: 'od',
            reason: reason || 'OD Approved by Principal',
            pendingOD: false,
            odRequestId: null
          };
        } else {
          // Mark others as present (default for future dates)
          return {
            studentId: s._id,
            rollNumber: s.rollNumber,
            name: s.name,
            email: s.email,
            status: 'present'
          };
        }
      });
      
      // Create new attendance record
      attendance = new Attendance({
        classId: normalizedClassId,
        date: attendanceDate,
        facultyId: faculty._id,
        department: department || student.department,
        records: records,
        totalStudents: records.length,
        totalPresent: records.filter(r => r.status === 'present').length,
        totalAbsent: 0,
        totalOD: 1, // Only the approved student
        status: 'finalized', // Future ODs are finalized immediately
        notes: `OD pre-approved for ${student.name} (${student.rollNumber})`,
        createdBy: principalId,
        updatedBy: principalId
      });
      
      await attendance.save();
      
      console.log('✅ Created new attendance record for future OD:', {
        classId: normalizedClassId,
        date: attendanceDate,
        totalStudents: records.length,
        totalOD: 1
      });
    } else {
      throw new Error(`Attendance record not found for class ${normalizedClassId} on date ${attendanceDate}`);
    }
  } else {
    // Existing attendance record - update the student's status
    const recordIndex = attendance.records.findIndex(
      r => {
        if (!r.studentId) return false;
        const recordStudentId = r.studentId.toString ? r.studentId.toString() : String(r.studentId);
        return recordStudentId === studentIdStr;
      }
    );
    
    if (recordIndex === -1) {
      // Student not in attendance record, add them
      attendance.records.push({
        studentId: student._id,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        status: 'od',
        reason: reason || 'OD Approved by Principal',
        pendingOD: false,
        odRequestId: null
      });
    } else {
      // Update existing record
      attendance.records[recordIndex].status = 'od';
      attendance.records[recordIndex].reason = reason || 'OD Approved by Principal';
      attendance.records[recordIndex].pendingOD = false;
      attendance.records[recordIndex].odRequestId = null;
    }
    
    // Mark the records array as modified so Mongoose saves the changes
    attendance.markModified('records');
    
    // Recalculate totals
    attendance.totalPresent = attendance.records.filter(r => r.status === 'present').length;
    attendance.totalAbsent = attendance.records.filter(r => r.status === 'absent').length;
    attendance.totalOD = attendance.records.filter(r => r.status === 'od').length;
    
    // Check if there are any remaining pending ODs
    const hasPendingOD = attendance.records.some(r => r.pendingOD === true);
    
    // Update status - if all pending ODs are approved, change to modified
    if (!hasPendingOD && attendance.status === 'pending_od_approval') {
      attendance.status = 'modified';
    } else if (attendance.status !== 'pending_od_approval') {
      attendance.status = 'modified';
    }
    
    // Mark as updated
    attendance.updatedBy = principalId;
    
    await attendance.save();
  }
  
  // Notifications will be sent by sendApprovalNotification function
  
  console.log('✅ OD Request approved and attendance updated:', {
    studentId,
    classId: normalizedClassId,
    date: attendanceDate,
    newStatus: 'od',
    totalOD: attendance.totalOD,
    attendanceStatus: attendance.status,
    isFutureOD: isFutureOD || false
  });
  
  return { studentId, date: attendanceDate, classId: normalizedClassId, status: 'od', isFutureOD: isFutureOD || false };
}

// Approve Holiday Request
async function approveHolidayRequest(request, principalId) {
  const { date, department, scope, reason, classDetails } = request.details;
  const requestedBy = request.requestedBy._id || request.requestedBy;
  
  const holidayData = {
    date: new Date(date).toISOString().split('T')[0],
    department: department || null,
    scope: scope || 'global',
    reason: reason || 'Approved by Principal',
    isActive: true,
    isDeleted: false,
    declaredBy: requestedBy,
    createdBy: principalId
  };
  
  // Add class-specific details if provided
  if (classDetails) {
    holidayData.batchYear = classDetails.batchYear;
    holidayData.section = classDetails.section;
    holidayData.semester = classDetails.semester;
    holidayData.scope = 'class';
  }
  
  const holiday = new Holiday(holidayData);
  await holiday.save();
  
  // Send notifications to faculty (asynchronously)
  (async () => {
    try {
      const Faculty = (await import('../models/Faculty.js')).default;
      const ClassAssignment = (await import('../models/ClassAssignment.js')).default;
      const Notification = (await import('../models/Notification.js')).default;
      
      const facultyList = [];
      
      if (scope === 'class' && classDetails) {
        // Find faculty assigned to this specific class
        const classIdFormats = [
          `${classDetails.batchYear}_${classDetails.semester}_${classDetails.section}`,
          `${classDetails.batchYear}_Sem ${classDetails.semester}_${classDetails.section}`,
          `${classDetails.batchYear}_Sem${classDetails.semester}_${classDetails.section}`
        ];
        
        for (const classIdFormat of classIdFormats) {
          const assignments = await ClassAssignment.find({
            $or: [
              { classId: classIdFormat },
              { batch: classDetails.batchYear, section: classDetails.section, semester: classDetails.semester }
            ],
            department: department,
            status: 'active'
          });
          
          for (const assignment of assignments) {
            const faculty = await Faculty.findById(assignment.facultyId);
            if (faculty && faculty.userId) {
              if (!facultyList.includes(faculty.userId.toString())) {
                facultyList.push(faculty.userId.toString());
              }
            }
          }
        }
      } else {
        // Global holiday - notify all faculty in department
        const allFaculty = await Faculty.find({
          department: department,
          status: 'active'
        });
        
        facultyList.push(...allFaculty
          .filter(f => f.userId)
          .map(f => f.userId.toString())
          .filter((id, index, self) => self.indexOf(id) === index)
        );
      }

      // Create notifications
      const notificationMessage = scope === 'class' && classDetails
        ? `Holiday approved for ${classDetails.batchYear} | ${classDetails.semester} | Section ${classDetails.section} on ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${reason}`
        : `Global holiday approved on ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${reason}`;

      const notifications = facultyList.map(userId => ({
        userId,
        title: 'Holiday Approved',
        message: notificationMessage,
        type: 'holiday',
        department: department,
        classRef: scope === 'class' && classDetails ? `${classDetails.batchYear}_${classDetails.semester}_${classDetails.section}` : null,
        metadata: {
          holidayId: holiday._id,
          date: date,
          reason,
          scope,
          approvedBy: principalId
        },
        priority: 'medium',
        sentBy: principalId
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        console.log(`✅ Created ${notifications.length} notifications for approved holiday`);
      }
    } catch (error) {
      console.error('❌ Error creating holiday approval notifications:', error);
    }
  })();
  
  return { holidayId: holiday._id, date, department, scope };
}

// Approve Leave Exception
async function approveLeaveException(request, principalId) {
  const { facultyId, date, correction } = request.details;
  
  // This would typically update faculty attendance records
  // Implementation depends on your faculty attendance model
  
  return { facultyId, date, correction, status: 'approved' };
}

// Approve Attendance Edit
async function approveAttendanceEdit(request, principalId) {
  const { attendanceId, studentId, date, originalStatus, newStatus, reason } = request.details;
  
  const attendance = await Attendance.findById(attendanceId);
  
  if (attendance) {
    const recordIndex = attendance.records.findIndex(
      r => r.studentId.toString() === studentId.toString()
    );
    
    if (recordIndex !== -1) {
      attendance.records[recordIndex].status = newStatus;
      attendance.records[recordIndex].reason = reason || 'Edited by Principal approval';
      attendance.records[recordIndex].modifiedBy = principalId;
      attendance.records[recordIndex].modifiedAt = new Date();
      attendance.status = 'modified';
      await attendance.save();
    }
  }
  
  return { attendanceId, studentId, date, originalStatus, newStatus };
}

// Send approval notification
async function sendApprovalNotification(request, action, details) {
  try {
    const principalId = request.approval?.approvedBy || request.approval?.rejectedBy;
    const department = request.details.department || request.requestedBy.department;
    
    // Notify the requester (faculty/HOD)
    const requesterNotification = {
      type: 'system',
      title: `OD Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your OD request has been ${action}.`,
      sentBy: principalId,
      department: department,
      priority: action === 'approved' ? 'medium' : 'high'
    };
    
    if (request.requestedBy._id) {
      requesterNotification.userId = request.requestedBy._id;
    } else if (request.requestedBy.role === 'faculty') {
      const faculty = await Faculty.findOne({ userId: request.requestedBy._id });
      if (faculty) {
        requesterNotification.facultyId = faculty._id;
      }
    }
    
    if (action === 'rejected' && request.approval?.remarks) {
      requesterNotification.message += ` Reason: ${request.approval.remarks}`;
    }
    
    // For OD requests, also notify the student
    if (request.type === 'OD_REQUEST' && request.details.studentId) {
      const student = await Student.findById(request.details.studentId);
      if (student && student.userId) {
        const studentNotification = {
          type: 'system',
          title: `OD Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
          message: action === 'approved' 
            ? `Your OD request for ${request.details.date} has been approved by the Principal.`
            : `Your OD request for ${request.details.date} has been rejected. ${request.approval?.remarks ? `Reason: ${request.approval.remarks}` : ''}`,
          userId: student.userId,
          sentBy: principalId,
          department: student.department,
          priority: action === 'approved' ? 'medium' : 'high',
          actionUrl: '/student/dashboard'
        };
        
        await Notification.create(studentNotification);
      }
    }
    
    await Notification.create(requesterNotification);
  } catch (error) {
    console.error('Error sending approval notification:', error);
  }
}

export default router;


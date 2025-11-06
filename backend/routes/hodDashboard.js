import express from 'express';
import { authenticate, hodAndAbove, restrictInactiveHOD } from '../middleware/auth.js';
import DepartmentSettings from '../models/DepartmentSettings.js';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import ClassAssignment from '../models/ClassAssignment.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// ============================================================================
// 1. DEPARTMENT ANALYTICS
// ============================================================================

// @desc    Get comprehensive department analytics
// @route   GET /api/hod/analytics
// @access  HOD and above
router.get('/analytics', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const { fromDate, toDate } = req.query;

    console.log('📊 Fetching analytics for department:', department);

    // Date range (default: last 30 days)
    const endDate = toDate || new Date().toISOString().split('T')[0];
    const startDate = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch all attendance records in date range
    const attendanceRecords = await Attendance.find({
      department,
      date: { $gte: startDate, $lte: endDate }
    }).populate('facultyId', 'name').lean();

    // Get all students in department
    const totalStudents = await Student.countDocuments({
      department,
      status: 'active'
    });

    // Get all faculty in department
    const allFaculty = await User.find({
      department,
      role: 'faculty',
      status: 'active'
    }).select('name email').lean();

    // ===================== CLASS-WISE ATTENDANCE =====================
    const classAttendanceMap = new Map();
    const facultyAttendanceMap = new Map();
    const monthlyTrendsMap = new Map();
    
    attendanceRecords.forEach(record => {
      // Class-wise aggregation
      const classKey = record.classId || 'Unknown';
      if (!classAttendanceMap.has(classKey)) {
        classAttendanceMap.set(classKey, {
          classId: classKey,
          totalSessions: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalStudents: 0
        });
      }
      
      const classData = classAttendanceMap.get(classKey);
      classData.totalSessions++;
      
      if (record.records && Array.isArray(record.records)) {
        record.records.forEach(studentRecord => {
          classData.totalStudents++;
          const status = studentRecord.status && studentRecord.status.toLowerCase();
          // Include OD as present
          if (status === 'present' || status === 'od' || status === 'onduty') {
            classData.totalPresent++;
          } else {
            classData.totalAbsent++;
          }
        });
      }

      // Faculty-wise aggregation
      const facultyId = record.facultyId?._id?.toString() || record.facultyId?.toString();
      const facultyName = record.facultyId?.name || 'Unknown';
      
      if (facultyId && facultyId !== 'Unknown') {
        if (!facultyAttendanceMap.has(facultyId)) {
          facultyAttendanceMap.set(facultyId, {
            facultyId,
            facultyName,
            totalSessions: 0,
            totalPresent: 0,
            totalAbsent: 0,
            classesHandled: new Set()
          });
        }
        
        const facultyData = facultyAttendanceMap.get(facultyId);
        facultyData.totalSessions++;
        facultyData.classesHandled.add(classKey);
        
        if (record.records && Array.isArray(record.records)) {
          record.records.forEach(studentRecord => {
            const status = studentRecord.status && studentRecord.status.toLowerCase();
            // Include OD as present
            if (status === 'present' || status === 'od' || status === 'onduty') {
              facultyData.totalPresent++;
            } else {
              facultyData.totalAbsent++;
            }
          });
        }
      }

      // Monthly trends
      const monthKey = record.date.substring(0, 7); // YYYY-MM
      if (!monthlyTrendsMap.has(monthKey)) {
        monthlyTrendsMap.set(monthKey, {
          month: monthKey,
          totalPresent: 0,
          totalAbsent: 0
        });
      }
      
      const monthData = monthlyTrendsMap.get(monthKey);
      if (record.records && Array.isArray(record.records)) {
        record.records.forEach(studentRecord => {
          const status = studentRecord.status && studentRecord.status.toLowerCase();
          // Include OD as present
          if (status === 'present' || status === 'od' || status === 'onduty') {
            monthData.totalPresent++;
          } else {
            monthData.totalAbsent++;
          }
        });
      }
    });

    // ===================== COMPUTE PERCENTAGES & RANKINGS =====================
    
    // Class-wise attendance with percentages
    const classWiseData = Array.from(classAttendanceMap.values()).map(cls => {
      const totalRecords = cls.totalPresent + cls.totalAbsent;
      const percentage = totalRecords > 0 
        ? ((cls.totalPresent / totalRecords) * 100).toFixed(2)
        : 0;
      
      return {
        ...cls,
        attendancePercentage: parseFloat(percentage)
      };
    }).sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    // Faculty-wise performance
    const facultyPerformance = Array.from(facultyAttendanceMap.values()).map(fac => {
      const totalRecords = fac.totalPresent + fac.totalAbsent;
      const avgAttendance = totalRecords > 0
        ? ((fac.totalPresent / totalRecords) * 100).toFixed(2)
        : 0;
      
      return {
        facultyId: fac.facultyId,
        facultyName: fac.facultyName,
        totalSessions: fac.totalSessions,
        classesHandled: fac.classesHandled.size,
        avgAttendance: parseFloat(avgAttendance),
        totalPresent: fac.totalPresent,
        totalAbsent: fac.totalAbsent
      };
    }).sort((a, b) => b.avgAttendance - a.avgAttendance);

    // Monthly trends with percentages
    const monthlyTrends = Array.from(monthlyTrendsMap.values()).map(month => {
      const total = month.totalPresent + month.totalAbsent;
      const percentage = total > 0
        ? ((month.totalPresent / total) * 100).toFixed(2)
        : 0;
      
      return {
        month: month.month,
        attendancePercentage: parseFloat(percentage),
        totalPresent: month.totalPresent,
        totalAbsent: month.totalAbsent
      };
    }).sort((a, b) => a.month.localeCompare(b.month));

    // ===================== DEPARTMENT AVERAGES =====================
    
    const departmentTotalPresent = Array.from(classAttendanceMap.values())
      .reduce((sum, cls) => sum + cls.totalPresent, 0);
    const departmentTotalAbsent = Array.from(classAttendanceMap.values())
      .reduce((sum, cls) => sum + cls.totalAbsent, 0);
    const departmentTotal = departmentTotalPresent + departmentTotalAbsent;
    const departmentAvgAttendance = departmentTotal > 0
      ? ((departmentTotalPresent / departmentTotal) * 100).toFixed(2)
      : 0;

    // ===================== HIGHLIGHTS =====================
    
    const highlights = [];
    
    // Trend comparison (current month vs previous month)
    if (monthlyTrends.length >= 2) {
      const currentMonth = monthlyTrends[monthlyTrends.length - 1];
      const previousMonth = monthlyTrends[monthlyTrends.length - 2];
      const diff = (currentMonth.attendancePercentage - previousMonth.attendancePercentage).toFixed(2);
      
      if (diff > 0) {
        highlights.push({
          type: 'positive',
          icon: '🟢',
          message: `Department average attendance is up by ${diff}% this month.`
        });
      } else if (diff < 0) {
        highlights.push({
          type: 'negative',
          icon: '🔴',
          message: `Department average attendance dropped by ${Math.abs(diff)}% this month.`
        });
      }
    }

    // Low performing classes
    const lowClasses = classWiseData.filter(cls => cls.attendancePercentage < 70);
    if (lowClasses.length > 0) {
      lowClasses.forEach(cls => {
        highlights.push({
          type: 'warning',
          icon: '⚠️',
          message: `Class ${cls.classId} dropped below 70% attendance (${cls.attendancePercentage}%).`
        });
      });
    }

    // Top performers
    if (facultyPerformance.length > 0) {
      highlights.push({
        type: 'positive',
        icon: '🏆',
        message: `Top performing faculty: ${facultyPerformance[0].facultyName} with ${facultyPerformance[0].avgAttendance}% average attendance.`
      });
    }

    // ===================== RESPONSE =====================
    
    res.json({
      success: true,
      data: {
        summary: {
          totalStudents,
          totalFaculty: allFaculty.length,
          departmentAvgAttendance: parseFloat(departmentAvgAttendance),
          totalSessions: attendanceRecords.length,
          dateRange: { startDate, endDate }
        },
        classWiseAttendance: classWiseData,
        facultyPerformance: {
          topPerformers: facultyPerformance.slice(0, 3),
          allFaculty: facultyPerformance
        },
        monthlyTrends,
        lowPerformingClasses: classWiseData.filter(cls => cls.attendancePercentage < 75),
        highlights
      }
    });

  } catch (error) {
    console.error('❌ Error fetching department analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department analytics',
      error: error.message
    });
  }
});

// ============================================================================
// 2. ATTENDANCE POLICY MANAGEMENT
// ============================================================================

// @desc    Get department attendance policy settings
// @route   GET /api/hod/settings
// @access  HOD and above
router.get('/settings', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const settings = await DepartmentSettings.getOrCreateSettings(department);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ Error fetching department settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
  }
});

// @desc    Update department attendance policy settings
// @route   PUT /api/hod/settings
// @access  HOD and above
router.put('/settings', authenticate, hodAndAbove, restrictInactiveHOD, async (req, res) => {
  try {
    const department = req.user.department;
    const updates = req.body;

    const settings = await DepartmentSettings.findOneAndUpdate(
      { department },
      { 
        ...updates,
        updatedBy: req.user._id
      },
      { new: true, upsert: true, runValidators: true }
    );

    console.log('✅ Updated department settings for', department);

    res.json({
      success: true,
      message: 'Department settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('❌ Error updating department settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
});

// ============================================================================
// 3. DEFAULTERS LIST (AI-ENHANCED)
// ============================================================================

// @desc    Get list of students below attendance threshold
// @route   GET /api/hod/defaulters
// @access  HOD and above
router.get('/defaulters', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const { threshold, classId } = req.query;

    // Get department settings for threshold
    const settings = await DepartmentSettings.getOrCreateSettings(department);
    const attendanceThreshold = threshold 
      ? parseFloat(threshold)
      : settings.attendancePolicy.minimumPercentage;

    console.log('🚨 Fetching defaulters below', attendanceThreshold, '% for', department);

    // Build query
    const attendanceQuery = { department };
    if (classId) {
      attendanceQuery.classId = classId;
    }

    // Fetch all attendance records
    const attendanceRecords = await Attendance.find(attendanceQuery).lean();

    // Calculate student-wise attendance
    const studentMap = new Map();

    attendanceRecords.forEach(record => {
      if (record.records && Array.isArray(record.records)) {
        record.records.forEach(studentRecord => {
          const studentId = studentRecord.studentId.toString();

          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              studentId: studentRecord.studentId,
              name: studentRecord.name,
              rollNumber: studentRecord.rollNumber,
              email: studentRecord.email,
              classId: record.classId,
              totalSessions: 0,
              attendedSessions: 0,
              absentSessions: 0,
              odSessions: 0
            });
          }

          const student = studentMap.get(studentId);
          student.totalSessions++;

          const status = studentRecord.status && studentRecord.status.toLowerCase();
          // Include OD as present for attendance calculation
          if (status === 'present') {
            student.attendedSessions++;
          } else if (status === 'od' || status === 'onduty') {
            student.attendedSessions++; // OD counts as present
            student.odSessions++;
          } else {
            student.absentSessions++;
          }
        });
      }
    });

    // Filter defaulters (OD is considered as present in percentage calculation)
    const defaulters = Array.from(studentMap.values())
      .map(student => {
        // attendedSessions already includes OD, so percentage is correct
        const percentage = student.totalSessions > 0
          ? ((student.attendedSessions / student.totalSessions) * 100).toFixed(2)
          : 0;

        return {
          ...student,
          attendancePercentage: parseFloat(percentage),
          odSessions: student.odSessions || 0
        };
      })
      .filter(student => student.attendancePercentage < attendanceThreshold)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    // AI-Generated Recommendations
    const aiRecommendations = [];

    if (defaulters.length > 0) {
      // Critical cases (below 60%)
      const criticalCases = defaulters.filter(s => s.attendancePercentage < 60);
      if (criticalCases.length > 0) {
        aiRecommendations.push({
          severity: 'critical',
          icon: '🚨',
          message: `${criticalCases.length} student(s) are critically below 60% attendance. Immediate intervention required.`,
          action: 'Schedule parent-teacher meeting',
          students: criticalCases.slice(0, 5).map(s => s.name)
        });
      }

      // Warning cases (60-75%)
      const warningCases = defaulters.filter(s => s.attendancePercentage >= 60 && s.attendancePercentage < attendanceThreshold);
      if (warningCases.length > 0) {
        aiRecommendations.push({
          severity: 'warning',
          icon: '⚠️',
          message: `${warningCases.length} student(s) are at risk of falling below the minimum threshold.`,
          action: 'Send attendance warning notifications',
          students: warningCases.slice(0, 5).map(s => s.name)
        });
      }

      // Trend analysis
      const avgDefaulterAttendance = (defaulters.reduce((sum, s) => sum + s.attendancePercentage, 0) / defaulters.length).toFixed(2);
      aiRecommendations.push({
        severity: 'info',
        icon: '📊',
        message: `Average attendance of defaulters: ${avgDefaulterAttendance}%. Department-wide awareness session recommended.`,
        action: 'Conduct attendance awareness session'
      });
    }

    res.json({
      success: true,
      data: {
        threshold: attendanceThreshold,
        totalDefaulters: defaulters.length,
        defaulters,
        aiRecommendations,
        summary: {
          critical: defaulters.filter(s => s.attendancePercentage < 60).length,
          warning: defaulters.filter(s => s.attendancePercentage >= 60 && s.attendancePercentage < attendanceThreshold).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching defaulters:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching defaulters list',
      error: error.message
    });
  }
});

// ============================================================================
// 4. STUDENT REPORTS
// ============================================================================

// @desc    Generate comprehensive student reports
// @route   GET /api/hod/student-reports
// @access  HOD and above
router.get('/student-reports', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const { classId, facultyId, fromDate, toDate } = req.query;

    console.log('📊 Generating student reports for department:', department);
    console.log('Filters:', { classId, facultyId, fromDate, toDate });

    // Build attendance query
    const attendanceQuery = { department };
    if (classId) attendanceQuery.classId = classId;
    if (facultyId) attendanceQuery.facultyId = facultyId;
    if (fromDate || toDate) {
      attendanceQuery.date = {};
      if (fromDate) attendanceQuery.date.$gte = fromDate;
      if (toDate) attendanceQuery.date.$lte = toDate;
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(attendanceQuery)
      .populate('facultyId', 'name')
      .lean();

    console.log('📚 Found', attendanceRecords.length, 'attendance records');

    // Aggregate student-wise attendance
    const studentMap = new Map();

    attendanceRecords.forEach(record => {
      if (record.records && Array.isArray(record.records)) {
        record.records.forEach(studentRecord => {
          const studentId = studentRecord.studentId.toString();

          if (!studentMap.has(studentId)) {
            studentMap.set(studentId, {
              studentId: studentRecord.studentId,
              rollNumber: studentRecord.rollNumber,
              studentName: studentRecord.name,
              email: studentRecord.email,
              class: record.classId,
              facultyName: record.facultyId?.name || 'N/A',
              totalSessions: 0,
              attendedSessions: 0,
              absentSessions: 0
            });
          }

          const student = studentMap.get(studentId);
          student.totalSessions++;

          // Check status (OD is considered as present)
          const status = studentRecord.status && studentRecord.status.toLowerCase();
          if (status === 'present' || status === 'od' || status === 'onduty') {
            student.attendedSessions++;
          } else {
            student.absentSessions++;
          }
        });
      }
    });

    // Calculate percentages and categorize
    const reports = Array.from(studentMap.values()).map(student => {
      const percentage = student.totalSessions > 0
        ? ((student.attendedSessions / student.totalSessions) * 100).toFixed(2)
        : 0;

      const attendancePercentage = parseFloat(percentage);
      let category;

      if (attendancePercentage >= 90) {
        category = 'Excellent';
      } else if (attendancePercentage >= 75) {
        category = 'Good';
      } else {
        category = 'Poor';
      }

      return {
        ...student,
        attendancePercentage,
        category
      };
    });

    // Summary statistics
    const summary = {
      totalStudents: reports.length,
      excellent: reports.filter(s => s.category === 'Excellent').length,
      good: reports.filter(s => s.category === 'Good').length,
      poor: reports.filter(s => s.category === 'Poor').length,
      averageAttendance: reports.length > 0
        ? (reports.reduce((sum, s) => sum + s.attendancePercentage, 0) / reports.length).toFixed(2)
        : 0
    };

    console.log('✅ Generated reports for', reports.length, 'students');

    res.json({
      success: true,
      data: {
        reports,
        summary,
        filters: {
          classId: classId || 'all',
          facultyId: facultyId || 'all',
          fromDate: fromDate || 'all',
          toDate: toDate || 'all'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generating student reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating student reports',
      error: error.message
    });
  }
});

// @desc    Get detailed student attendance records
// @route   GET /api/hod/student-reports/:studentId
// @access  HOD and above
router.get('/student-reports/:studentId', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { fromDate, toDate } = req.query;
    const department = req.user.department;

    console.log('📖 Fetching detailed records for student:', studentId);

    // Get student info
    const student = await Student.findById(studentId).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Build query for attendance records
    const query = {
      department,
      'records.studentId': studentId
    };

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .populate('facultyId', 'name')
      .sort({ date: -1 })
      .lean();

    // Extract student-specific records
    const records = [];
    let totalPresent = 0;
    let totalAbsent = 0;
    let maxConsecutiveAbsences = 0;
    let currentConsecutiveAbsences = 0;
    let lastAttendanceDate = null;

    attendanceRecords.forEach(record => {
      const studentRecord = record.records.find(
        r => r.studentId.toString() === studentId
      );

      if (studentRecord) {
        // Normalize status to title case
        let normalizedStatus = studentRecord.status || 'Not Marked';
        const statusLower = studentRecord.status && studentRecord.status.toLowerCase();
        if (statusLower === 'present') {
          normalizedStatus = 'Present';
        } else if (statusLower === 'od' || statusLower === 'onduty') {
          normalizedStatus = 'OD';
        } else if (statusLower === 'absent') {
          normalizedStatus = 'Absent';
        }

        records.push({
          date: record.date,
          classId: record.classId,
          facultyName: record.facultyId?.name || 'Unknown',
          status: normalizedStatus,
          reason: studentRecord.reason || '',
          facultyNote: record.note || ''
        });

        // Include OD as present for calculations
        const status = studentRecord.status && studentRecord.status.toLowerCase();
        if (status === 'present' || status === 'od' || status === 'onduty') {
          totalPresent++;
          currentConsecutiveAbsences = 0;
        } else {
          totalAbsent++;
          currentConsecutiveAbsences++;
          maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, currentConsecutiveAbsences);
        }

        if (!lastAttendanceDate || new Date(record.date) > new Date(lastAttendanceDate)) {
          lastAttendanceDate = record.date;
        }
      }
    });

    const totalSessions = totalPresent + totalAbsent;
    const attendancePercentage = totalSessions > 0
      ? ((totalPresent / totalSessions) * 100).toFixed(2)
      : 0;

    let category;
    if (attendancePercentage >= 90) category = 'Excellent';
    else if (attendancePercentage >= 75) category = 'Good';
    else category = 'Poor';

    res.json({
      success: true,
      data: {
        student: {
          rollNumber: student.rollNumber,
          name: student.name,
          email: student.email,
          department: student.department
        },
        attendance: {
          totalSessions,
          totalPresent,
          totalAbsent,
          attendancePercentage: parseFloat(attendancePercentage),
          category
        },
        insights: {
          maxConsecutiveAbsences,
          currentConsecutiveAbsences,
          lastAttendanceDate
        },
        records
      }
    });

  } catch (error) {
    console.error('❌ Error fetching student details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student details',
      error: error.message
    });
  }
});

// ============================================================================
// 5. NOTIFICATION MANAGEMENT
// ============================================================================

// @desc    Send department-wide notification
// @route   POST /api/hod/notifications
// @access  HOD and above
router.post('/notifications', authenticate, hodAndAbove, restrictInactiveHOD, async (req, res) => {
  try {
    const { title, message, targetRole, attachments } = req.body;
    const department = req.user.department;

    // Validate input
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Determine recipients based on target role
    const recipientQuery = {
      department,
      status: 'active'
    };

    if (targetRole && targetRole !== 'all') {
      recipientQuery.role = targetRole;
    }

    const recipients = await User.find(recipientQuery).select('_id').lean();

    // Generate a unique broadcast ID for this batch
    const broadcastId = `${req.user._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create notifications for all recipients
    const notifications = recipients.map(recipient => ({
      userId: recipient._id,
      type: 'system',
      title,
      message,
      department,
      sentBy: req.user._id,
      broadcastId, // Same ID for all notifications in this broadcast
      status: 'sent', // Mark as sent
      read: false,
      // Store metadata about the broadcast
      metadata: {
        targetRole: targetRole || 'all',
        sentToCount: recipients.length
      }
    }));

    await Notification.insertMany(notifications);

    console.log('✅ Sent', notifications.length, 'notifications to', department, targetRole || 'all');

    res.json({
      success: true,
      message: `Notification sent to ${notifications.length} recipient(s)`,
      data: {
        totalRecipients: notifications.length,
        targetRole: targetRole || 'all'
      }
    });

  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notifications',
      error: error.message
    });
  }
});

// @desc    Get sent notifications history (grouped by broadcast)
// @route   GET /api/hod/notifications/history
// @access  HOD and above
router.get('/notifications/history', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const { limit = 50, page = 1, includeArchived = 'false' } = req.query;

    // Build match query - by default exclude archived notifications
    const matchQuery = {
      department,
      sentBy: req.user._id
    };

    if (includeArchived !== 'true') {
      matchQuery.isArchived = { $ne: true };
    }

    // Aggregate notifications to group by broadcastId
    const notifications = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$broadcastId', // Group by broadcastId (unique per send action)
          // Take the first notification's ID for actions (archive, recall, etc.)
          notificationId: { $first: '$_id' },
          title: { $first: '$title' },
          message: { $first: '$message' },
          type: { $first: '$type' },
          status: { $first: '$status' },
          createdAt: { $first: '$createdAt' },
          isArchived: { $first: '$isArchived' },
          recallInfo: { $first: '$recallInfo' },
          sentBy: { $first: '$sentBy' },
          broadcastId: { $first: '$broadcastId' },
          metadata: { $first: '$metadata' },
          // Count total recipients
          recipientCount: { $sum: 1 },
          // Collect all recipient IDs
          recipientIds: { $push: '$userId' }
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'sentBy',
          foreignField: '_id',
          as: 'sentByUser'
        }
      },
      {
        $project: {
          _id: '$notificationId', // Use the first notification's ID
          title: 1,
          message: 1,
          type: 1,
          status: 1,
          createdAt: 1,
          isArchived: 1,
          recallInfo: 1,
          recipientCount: 1,
          metadata: 1,
          sentBy: {
            _id: { $arrayElemAt: ['$sentByUser._id', 0] },
            name: { $arrayElemAt: ['$sentByUser.name', 0] }
          }
        }
      }
    ]);

    // Get total count of unique broadcasts
    const totalAgg = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$broadcastId' // Group by broadcastId
        }
      },
      { $count: 'total' }
    ]);

    const total = totalAgg.length > 0 ? totalAgg[0].total : 0;

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching notification history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification history',
      error: error.message
    });
  }
});

// @desc    Archive a sent notification (soft delete)
// @route   PUT /api/hod/notifications/:id/archive
// @access  HOD and above
router.put('/notifications/:id/archive', authenticate, hodAndAbove, restrictInactiveHOD, async (req, res) => {
  try {
    const { id } = req.params;

    // Find notification and verify ownership
    const notification = await Notification.findOne({
      _id: id,
      sentBy: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you do not have permission to archive it'
      });
    }

    // Only sent and recalled notifications can be archived
    if (notification.status !== 'sent' && notification.status !== 'recalled') {
      return res.status(400).json({
        success: false,
        message: `Cannot archive ${notification.status} notifications. Only sent or recalled notifications can be archived.`
      });
    }

    // Archive all notifications in this broadcast
    const result = await Notification.updateMany(
      { broadcastId: notification.broadcastId },
      { isArchived: true }
    );

    console.log('📦 Archived', result.modifiedCount, 'notification(s) with broadcastId:', notification.broadcastId);

    res.json({
      success: true,
      message: `Notification archived successfully (${result.modifiedCount} recipient${result.modifiedCount !== 1 ? 's' : ''})`,
      data: { 
        notificationId: id,
        archivedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('❌ Error archiving notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving notification',
      error: error.message
    });
  }
});

// @desc    Delete a draft or scheduled notification (permanent delete)
// @route   DELETE /api/hod/notifications/:id
// @access  HOD and above
router.delete('/notifications/:id', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;

    // Find notification and verify ownership
    const notification = await Notification.findOne({
      _id: id,
      sentBy: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you do not have permission to delete it'
      });
    }

    // Only draft and scheduled notifications can be permanently deleted
    if (notification.status !== 'draft' && notification.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${notification.status} notifications. Only draft or scheduled notifications can be permanently deleted. Use archive for sent notifications.`
      });
    }

    // Delete all notifications in this broadcast
    const result = await Notification.deleteMany({ 
      broadcastId: notification.broadcastId 
    });

    console.log('🗑️ Deleted', result.deletedCount, 'notification(s) with broadcastId:', notification.broadcastId);

    res.json({
      success: true,
      message: `Notification deleted successfully (${result.deletedCount} recipient${result.deletedCount !== 1 ? 's' : ''})`,
      data: { 
        notificationId: id,
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
});

// @desc    Recall a sent notification
// @route   POST /api/hod/notifications/:id/recall
// @access  HOD and above
router.post('/notifications/:id/recall', authenticate, hodAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find the original notification (one of the sent copies)
    const originalNotification = await Notification.findOne({
      _id: id,
      sentBy: req.user._id
    });

    if (!originalNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you do not have permission to recall it'
      });
    }

    // Only sent notifications can be recalled
    if (originalNotification.status !== 'sent') {
      return res.status(400).json({
        success: false,
        message: `Cannot recall ${originalNotification.status} notifications. Only sent notifications can be recalled.`
      });
    }

    // Find all copies of this notification using broadcastId
    const allCopies = await Notification.find({
      broadcastId: originalNotification.broadcastId,
      status: 'sent'
    });

    // Update all copies to recalled status
    const recallInfo = {
      recalledAt: new Date(),
      recallReason: reason || 'Recalled by sender',
      recalledBy: req.user._id
    };

    await Notification.updateMany(
      {
        _id: { $in: allCopies.map(n => n._id) }
      },
      {
        status: 'recalled',
        recallInfo
      }
    );

    // Generate a new broadcast ID for the recall notifications
    const recallBroadcastId = `${req.user._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send recall notification to all recipients
    const recallNotifications = allCopies.map(copy => ({
      userId: copy.userId,
      type: 'system',
      title: '⚠️ Notification Recalled',
      message: `The notification "${originalNotification.title}" has been recalled by the sender.\nReason: ${reason || 'Not specified'}`,
      department: originalNotification.department,
      sentBy: req.user._id,
      broadcastId: recallBroadcastId, // Same broadcast ID for all recall notifications
      status: 'sent',
      read: false
    }));

    await Notification.insertMany(recallNotifications);

    console.log('🔄 Recalled notification and sent', recallNotifications.length, 'recall notices');

    res.json({
      success: true,
      message: `Notification recalled successfully. ${recallNotifications.length} recipient(s) notified.`,
      data: {
        recalledCount: allCopies.length,
        notificationsSent: recallNotifications.length
      }
    });

  } catch (error) {
    console.error('❌ Error recalling notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error recalling notification',
      error: error.message
    });
  }
});

export default router;


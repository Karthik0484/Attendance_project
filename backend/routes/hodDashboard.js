import express from 'express';
import { authenticate, hodAndAbove } from '../middleware/auth.js';
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
          if (studentRecord.status === 'present') {
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
            if (studentRecord.status === 'present') {
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
          if (studentRecord.status === 'present') {
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
router.put('/settings', authenticate, hodAndAbove, async (req, res) => {
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
              absentSessions: 0
            });
          }

          const student = studentMap.get(studentId);
          student.totalSessions++;

          if (studentRecord.status === 'present') {
            student.attendedSessions++;
          } else {
            student.absentSessions++;
          }
        });
      }
    });

    // Filter defaulters
    const defaulters = Array.from(studentMap.values())
      .map(student => {
        const percentage = student.totalSessions > 0
          ? ((student.attendedSessions / student.totalSessions) * 100).toFixed(2)
          : 0;

        return {
          ...student,
          attendancePercentage: parseFloat(percentage)
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

          if (studentRecord.status === 'present') {
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
        records.push({
          date: record.date,
          classId: record.classId,
          facultyName: record.facultyId?.name || 'Unknown',
          status: studentRecord.status,
          reason: studentRecord.reason || '',
          facultyNote: record.note || ''
        });

        if (studentRecord.status === 'present') {
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
router.post('/notifications', authenticate, hodAndAbove, async (req, res) => {
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

    // Create notifications for all recipients
    const notifications = recipients.map(recipient => ({
      userId: recipient._id,
      type: 'system',
      title,
      message,
      department,
      sentBy: req.user._id,
      read: false
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

// @desc    Get sent notifications history
// @route   GET /api/hod/notifications/history
// @access  HOD and above
router.get('/notifications/history', authenticate, hodAndAbove, async (req, res) => {
  try {
    const department = req.user.department;
    const { limit = 50, page = 1 } = req.query;

    const notifications = await Notification.find({
      department,
      sentBy: req.user._id
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('sentBy', 'name')
      .lean();

    const total = await Notification.countDocuments({
      department,
      sentBy: req.user._id
    });

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

export default router;


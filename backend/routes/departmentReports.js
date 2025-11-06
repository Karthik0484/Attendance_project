import express from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Attendance from '../models/Attendance.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import DepartmentSettings from '../models/DepartmentSettings.js';
import DepartmentHODMapping from '../models/DepartmentHODMapping.js';
import ClassAssignment from '../models/ClassAssignment.js';

const router = express.Router();

// All routes require Principal role
router.use(authenticate);
router.use(authorize('principal'));

// Helper function to get date range
const getDateRange = (period) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (period) {
    case 'today':
      return {
        start: today.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      return {
        start: weekStart.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };
    case 'month':
      const monthStart = new Date(today);
      monthStart.setDate(1);
      return {
        start: monthStart.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };
    default:
      return {
        start: today.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };
  }
};

// @desc    Get comprehensive department reports
// @route   GET /api/principal/department-reports
// @access  Principal only
router.get('/', async (req, res) => {
  try {
    const { 
      department, 
      period = 'today', 
      startDate, 
      endDate,
      academicYear,
      semester,
      classId,
      facultyId
    } = req.query;

    // Determine date range
    let dateRange;
    if (startDate && endDate) {
      dateRange = { start: startDate, end: endDate };
    } else {
      dateRange = getDateRange(period);
    }

    const today = new Date().toISOString().split('T')[0];

    // Get all departments if not specified
    const departments = department 
      ? [department] 
      : ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'];

    // Get active holidays
    const holidays = await Holiday.find({
      isActive: true,
      isDeleted: false,
      date: { $gte: dateRange.start, $lte: dateRange.end }
    }).select('date scope department').lean();

    const holidayDates = new Set(holidays.map(h => h.date));

    // Process each department
    const departmentReports = await Promise.all(
      departments.map(async (dept) => {
        try {
          // 1. Department Overview
          const activeStudents = await Student.countDocuments({
            department: dept,
            status: 'active',
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false },
              { isDeleted: { $ne: true } }
            ]
          });

          const activeFaculty = await Faculty.countDocuments({
            department: dept,
            status: 'active',
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false },
              { isDeleted: { $ne: true } }
            ]
          });

          // Get HOD
          const hodMapping = await DepartmentHODMapping.findOne({
            departmentId: dept,
            status: 'active'
          }).populate('hodId', 'name email status accessLevel lastLogin').lean();

          // Get year-wise student count
          const yearWiseStudents = await Student.aggregate([
            {
              $match: {
                department: dept,
                status: 'active',
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false },
                  { isDeleted: { $ne: true } }
                ]
              }
            },
            {
              $unwind: '$semesters'
            },
            {
              $group: {
                _id: '$semesters.year',
                count: { $sum: 1 }
              }
            }
          ]);

          const yearWiseCount = {};
          yearWiseStudents.forEach(item => {
            yearWiseCount[item._id] = item.count;
          });

          // Get active classes
          const activeClasses = await ClassAssignment.distinct('classId', {
            status: 'active',
            department: dept
          });

          // 2. Today's Attendance Summary
          const todayAttendance = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: today,
                status: { $in: ['draft', 'finalized', 'modified'] }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                absent: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            }
          ]);

          const todayStats = todayAttendance[0] || { total: 0, present: 0, absent: 0, od: 0 };
          const todayPercentage = todayStats.total > 0
            ? Math.round(((todayStats.present + todayStats.od) / todayStats.total) * 100 * 10) / 10
            : 0;

          // 3. Weekly Attendance Trend (last 7 days)
          const weekRange = getDateRange('week');
          const weeklyTrend = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: weekRange.start,
                  $lte: weekRange.end,
                  $nin: Array.from(holidayDates)
                },
                status: { $in: ['draft', 'finalized', 'modified'] }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $group: {
                _id: '$date',
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                date: '$_id',
                percentage: {
                  $cond: [
                    { $gt: ['$total', 0] },
                    { $multiply: [{ $divide: [{ $add: ['$present', '$od'] }, '$total'] }, 100] },
                    0
                  ]
                }
              }
            },
            {
              $sort: { date: 1 }
            }
          ]);

          // 4. Monthly Attendance Trend
          const monthRange = getDateRange('month');
          const monthlyTrend = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: monthRange.start,
                  $lte: monthRange.end,
                  $nin: Array.from(holidayDates)
                },
                status: { $in: ['draft', 'finalized', 'modified'] }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $group: {
                _id: '$date',
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                date: '$_id',
                percentage: {
                  $cond: [
                    { $gt: ['$total', 0] },
                    { $multiply: [{ $divide: [{ $add: ['$present', '$od'] }, '$total'] }, 100] },
                    0
                  ]
                }
              }
            },
            {
              $sort: { date: 1 }
            }
          ]);

          // 5. Class-wise Attendance Summary
          const classAttendance = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: dateRange.start,
                  $lte: dateRange.end
                },
                status: { $in: ['draft', 'finalized', 'modified'] },
                date: { $nin: Array.from(holidayDates) }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $group: {
                _id: '$classId',
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                absent: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'absent'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                classId: '$_id',
                total: 1,
                present: 1,
                absent: 1,
                od: 1,
                percentage: {
                  $cond: [
                    { $gt: ['$total', 0] },
                    { $multiply: [{ $divide: [{ $add: ['$present', '$od'] }, '$total'] }, 100] },
                    0
                  ]
                }
              }
            },
            {
              $sort: { percentage: -1 }
            }
          ]);

          // 6. Faculty Performance Summary
          const facultyPerformance = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: dateRange.start,
                  $lte: dateRange.end
                },
                status: { $in: ['draft', 'finalized', 'modified'] }
              }
            },
            {
              $group: {
                _id: '$facultyId',
                classesHandled: { $addToSet: '$classId' },
                totalRecords: { $sum: 1 },
                attendanceCount: { $sum: { $size: '$records' } }
              }
            },
            {
              $lookup: {
                from: 'faculties',
                localField: '_id',
                foreignField: '_id',
                as: 'faculty'
              }
            },
            {
              $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true }
            },
            {
              $project: {
                facultyId: '$_id',
                facultyName: { $ifNull: ['$faculty.name', 'Unknown'] },
                classesHandled: { $size: '$classesHandled' },
                totalRecords: 1,
                attendanceCount: 1
              }
            }
          ]);

          // 7. Student Attendance Categories
          const activeStudentIds = await Student.find({
            department: dept,
            status: 'active',
            $or: [
              { isDeleted: { $exists: false } },
              { isDeleted: false },
              { isDeleted: { $ne: true } }
            ]
          }).select('_id').lean();

          const studentIds = activeStudentIds.map(s => s._id);

          const studentAttendance = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: dateRange.start,
                  $lte: dateRange.end
                },
                status: { $in: ['draft', 'finalized', 'modified'] },
                date: { $nin: Array.from(holidayDates) }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $match: {
                'records.studentId': { $in: studentIds }
              }
            },
            {
              $group: {
                _id: '$records.studentId',
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            },
            {
              $project: {
                studentId: '$_id',
                total: 1,
                present: 1,
                od: 1,
                percentage: {
                  $cond: [
                    { $gt: ['$total', 0] },
                    { $multiply: [{ $divide: [{ $add: ['$present', '$od'] }, '$total'] }, 100] },
                    0
                  ]
                }
              }
            }
          ]);

          // Categorize students
          const categories = {
            high: studentAttendance.filter(s => s.percentage >= 95),
            average: studentAttendance.filter(s => s.percentage >= 75 && s.percentage < 95),
            low: studentAttendance.filter(s => s.percentage >= 60 && s.percentage < 75),
            critical: studentAttendance.filter(s => s.percentage < 60)
          };

          // 8. Absentee & OD Insights
          const todayAbsentees = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: today,
                status: { $in: ['draft', 'finalized', 'modified'] }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $match: {
                'records.status': { $in: ['absent', 'od'] }
              }
            },
            {
              $group: {
                _id: '$records.studentId',
                count: { $sum: 1 },
                reasons: { $push: '$records.reason' }
              }
            }
          ]);

          // 9. HOD Metrics
          const hodMetrics = hodMapping ? {
            name: hodMapping.hodId?.name || 'N/A',
            email: hodMapping.hodId?.email || 'N/A',
            status: hodMapping.hodId?.status || 'N/A',
            assignedOn: hodMapping.assignedOn,
            tenureDays: Math.floor((new Date() - new Date(hodMapping.assignedOn)) / (1000 * 60 * 60 * 24)),
            facultyCount: activeFaculty
          } : null;

          // 10. Semester Performance Summary
          const semesterPerformance = await Attendance.aggregate([
            {
              $match: {
                department: dept,
                date: {
                  $gte: dateRange.start,
                  $lte: dateRange.end
                },
                status: { $in: ['draft', 'finalized', 'modified'] },
                date: { $nin: Array.from(holidayDates) }
              }
            },
            {
              $unwind: '$records'
            },
            {
              $group: {
                _id: {
                  classId: '$classId',
                  date: '$date'
                },
                total: { $sum: 1 },
                present: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] }
                },
                od: {
                  $sum: { $cond: [{ $eq: ['$records.status', 'od'] }, 1, 0] }
                }
              }
            },
            {
              $group: {
                _id: '$_id.classId',
                workingDays: { $addToSet: '$_id.date' },
                totalRecords: { $sum: '$total' },
                totalPresent: { $sum: { $add: ['$present', '$od'] } }
              }
            },
            {
              $project: {
                classId: '$_id',
                workingDays: { $size: '$workingDays' },
                avgAttendance: {
                  $cond: [
                    { $gt: ['$totalRecords', 0] },
                    { $multiply: [{ $divide: ['$totalPresent', '$totalRecords'] }, 100] },
                    0
                  ]
                }
              }
            }
          ]);

          // 11. Alerts & Issues
          const alerts = [];
          
          // Low attendance classes
          classAttendance.forEach(cls => {
            if (cls.percentage < 75) {
              alerts.push({
                type: 'low_attendance',
                severity: cls.percentage < 60 ? 'critical' : 'warning',
                message: `Class ${cls.classId} has low attendance: ${cls.percentage.toFixed(1)}%`,
                classId: cls.classId
              });
            }
          });

          // Department average check
          const deptAvg = classAttendance.length > 0
            ? classAttendance.reduce((sum, cls) => sum + cls.percentage, 0) / classAttendance.length
            : 0;
          
          if (deptAvg < 75) {
            alerts.push({
              type: 'department_low_avg',
              severity: 'warning',
              message: `Department average attendance is below threshold: ${deptAvg.toFixed(1)}%`
            });
          }

          return {
            department: dept,
            overview: {
              departmentName: dept,
              hod: hodMapping?.hodId ? {
                name: hodMapping.hodId.name,
                email: hodMapping.hodId.email,
                status: hodMapping.hodId.status
              } : null,
              totalStudents: activeStudents,
              totalFaculty: activeFaculty,
              activeClasses: activeClasses.length,
              yearWiseStrength: yearWiseCount
            },
            todayAttendance: {
              total: todayStats.total,
              present: todayStats.present,
              absent: todayStats.absent,
              od: todayStats.od,
              percentage: todayPercentage
            },
            weeklyTrend: weeklyTrend.map(t => ({
              date: t.date,
              percentage: Math.round(t.percentage * 10) / 10
            })),
            monthlyTrend: monthlyTrend.map(t => ({
              date: t.date,
              percentage: Math.round(t.percentage * 10) / 10
            })),
            classAttendance: classAttendance.map(c => ({
              classId: c.classId,
              total: c.total,
              present: c.present,
              absent: c.absent,
              od: c.od,
              percentage: Math.round(c.percentage * 10) / 10,
              status: c.percentage >= 85 ? 'good' : c.percentage >= 75 ? 'average' : 'poor'
            })),
            facultyPerformance: facultyPerformance.map(f => ({
              facultyId: f.facultyId,
              facultyName: f.facultyName,
              classesHandled: f.classesHandled,
              attendanceRecords: f.totalRecords
            })),
            studentCategories: {
              high: categories.high.length,
              average: categories.average.length,
              low: categories.low.length,
              critical: categories.critical.length
            },
            absenteeInsights: {
              todayAbsentees: todayAbsentees.length,
              repeatAbsentees: 0, // Can be enhanced with date range analysis
              odCount: todayStats.od
            },
            hodMetrics: hodMetrics,
            semesterPerformance: semesterPerformance.map(s => ({
              classId: s.classId,
              workingDays: s.workingDays,
              avgAttendance: Math.round(s.avgAttendance * 10) / 10
            })),
            alerts: alerts
          };
        } catch (deptError) {
          console.error(`Error processing department ${dept}:`, deptError);
          return {
            department: dept,
            error: 'Failed to process department data'
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: {
        reports: departmentReports,
        dateRange,
        period
      }
    });
  } catch (error) {
    console.error('Error fetching department reports:', error);
    res.status(500).json({
      success: false,
      msg: 'Error fetching department reports',
      error: error.message
    });
  }
});

export default router;


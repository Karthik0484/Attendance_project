import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import attendanceRoutes from './routes/attendance.js';
import attendanceManagementRoutes from './routes/attendanceManagement.js';
import facultyRoutes from './routes/faculty.js';
import studentRoutes from './routes/student.js';
import reportRoutes from './routes/report.js';
import holidayRoutes from './routes/holiday.js';
import bulkUploadRoutes from './routes/bulkUpload.js';
import studentBulkUploadRoutes from './routes/studentBulkUpload.js';
import classAssignmentRoutes from './routes/classAssignment.js';
import semesterRoutes from './routes/semester.js';
import attendanceReasonRoutes from './routes/attendanceReason.js';
import notificationRoutes from './routes/notification.js';
import absenteeReportRoutes from './routes/absenteeReport.js';
import classRoutes from './routes/classes.js';
import config from './config/config.js';
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import Holiday from './models/Holiday.js';
import Faculty from './models/Faculty.js';

// Load environment variables
dotenv.config();

// Connect to database
console.log('🔌 Connecting to database...');
connectDB();
console.log('✅ Database connection initiated');

// Ensure indexes are in sync with schema (drops obsolete indexes like rollNumber_1)
try {
  Student.syncIndexes()
    .then(() => console.log('✅ Student indexes synced'))
    .catch(err => console.error('⚠️  Student index sync error:', err?.message || err));
  Attendance.syncIndexes()
    .then(() => console.log('✅ Attendance indexes synced'))
    .catch(err => console.error('⚠️  Attendance index sync error:', err?.message || err));
  Holiday.syncIndexes()
    .then(() => console.log('✅ Holiday indexes synced'))
    .catch(err => console.error('⚠️  Holiday index sync error:', err?.message || err));
  Faculty.syncIndexes()
    .then(() => console.log('✅ Faculty indexes synced'))
    .catch(err => console.error('⚠️  Faculty index sync error:', err?.message || err));
} catch (e) {
  console.error('⚠️  Index sync init error:', e?.message || e);
}

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (profile photos)
app.use('/uploads', express.static('uploads'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
console.log('🔧 Registering routes...');
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
// IMPORTANT: attendanceReasonRoutes must come BEFORE attendanceRoutes
// to avoid /:classId/:date pattern matching /reasons/pending
app.use('/api/attendance', attendanceReasonRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance-management', attendanceManagementRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/faculty/student', studentRoutes); // Faculty student management routes
app.use('/api/student', studentRoutes);
console.log('🔧 Registering bulk upload routes at /api/students/bulk-upload');
app.use('/api/students/bulk-upload', studentBulkUploadRoutes);
app.use('/api/students', studentRoutes);
console.log('🔧 Registering class routes at /api/classes');
app.use('/api/classes', classRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/class-assignment', classAssignmentRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', absenteeReportRoutes);
console.log('✅ All routes registered successfully');

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Attendance Tracker API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test route for bulk upload endpoint
app.get('/api/students/bulk-upload/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bulk upload endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

// API documentation route
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Attendance Tracker API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout'
      },
      admin: {
        users: 'GET /api/admin/users',
        createUser: 'POST /api/admin/users',
        updateUser: 'PUT /api/admin/users/:id',
        deleteUser: 'DELETE /api/admin/users/:id',
        dashboard: 'GET /api/admin/dashboard'
      },
      attendance: {
        mark: 'POST /api/attendance/mark',
        student: 'GET /api/attendance/student/:studentId',
        class: 'GET /api/attendance/class/:className',
        department: 'GET /api/attendance/department/:department',
        update: 'PUT /api/attendance/:id'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    msg: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false,
    msg: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

console.log('🚀 Starting server...');
app.listen(PORT, () => {
  console.log(`🚀 Attendance Tracker API Server`);
  console.log(`📡 Running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`🔐 Admin login: admin@attendance.com / password123`);
});

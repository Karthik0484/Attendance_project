/**
 * Test script to verify API routes are working correctly
 */

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

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance-management', attendanceManagementRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/students/bulk-upload', studentBulkUploadRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', studentRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/class-assignment', classAssignmentRoutes);

// Test route to verify all routes are mounted
app.get('/api/test-routes', (req, res) => {
  res.json({
    success: true,
    message: 'All routes are properly mounted',
    routes: [
      '/api/auth',
      '/api/admin', 
      '/api/attendance',
      '/api/attendance-management',
      '/api/faculty',
      '/api/student',
      '/api/students',
      '/api/students/bulk-upload',
      '/api/classes',
      '/api/report',
      '/api/holidays',
      '/api/bulk-upload',
      '/api/class-assignment'
    ],
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    msg: 'Route not found',
    requestedPath: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 5000;

console.log('🧪 Starting route test server...');
app.listen(PORT, () => {
  console.log(`🧪 Route test server running on port ${PORT}`);
  console.log(`🌐 Test routes: http://localhost:${PORT}/api/test-routes`);
  console.log(`🔍 Test bulk upload route: http://localhost:${PORT}/api/students/bulk-upload`);
});

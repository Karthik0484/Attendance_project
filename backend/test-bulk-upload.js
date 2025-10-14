/**
 * Test script to verify bulk upload route is working
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import studentBulkUploadRoutes from './routes/studentBulkUpload.js';

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

// Mount the bulk upload routes
app.use('/api/students/bulk-upload', studentBulkUploadRoutes);

// Test route to verify the server is running
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Bulk upload test server is running',
    timestamp: new Date().toISOString()
  });
});

// Test route to verify bulk upload endpoint exists
app.get('/api/students/bulk-upload/test', (req, res) => {
  res.json({
    success: true,
    message: 'Bulk upload endpoint is accessible',
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

const PORT = process.env.PORT || 5001; // Use different port to avoid conflicts

console.log('🧪 Starting bulk upload test server...');
app.listen(PORT, () => {
  console.log(`🧪 Bulk upload test server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Bulk upload test: http://localhost:${PORT}/api/students/bulk-upload/test`);
  console.log(`📤 Bulk upload endpoint: http://localhost:${PORT}/api/students/bulk-upload`);
});

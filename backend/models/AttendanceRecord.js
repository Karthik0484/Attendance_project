/**
 * AttendanceRecord Model - Student-level attendance tracking
 * This model tracks individual student attendance per day per semester
 * Used for student dashboard and semester-based analytics
 */

import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true,
    index: true
  },
  date: {
    type: String, // "YYYY-MM-DD" format for consistency
    required: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'OD', 'Holiday', 'Not Marked'],
    required: true,
    default: 'Not Marked'
  },
  // Student-submitted reason for absence
  reasonStudent: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: null
  },
  // Faculty-added reason/note
  reasonFaculty: {
    type: String,
    trim: true,
    maxlength: [500, 'Faculty reason cannot exceed 500 characters'],
    default: null
  },
  // Review status for student-submitted reasons
  reviewStatus: {
    type: String,
    enum: ['Pending', 'Reviewed', 'Not Applicable'],
    default: 'Not Applicable'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  // Semester statistics (cached for performance)
  semesterStats: {
    totalWorkingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    odDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 }
  },
  // Who last updated this record
  updatedBy: {
    type: String,
    enum: ['faculty', 'student', 'system', 'admin'],
    default: 'faculty'
  },
  // For audit trail
  department: {
    type: String,
    required: true,
    trim: true
  },
  batchYear: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Compound unique index - one record per student per date per semester
attendanceRecordSchema.index(
  { studentId: 1, semesterId: 1, date: 1 },
  { unique: true }
);

// Index for semester-based queries
attendanceRecordSchema.index({ semesterId: 1, date: -1 });

// Index for student queries
attendanceRecordSchema.index({ studentId: 1, date: -1 });

// Index for reason review queries
attendanceRecordSchema.index({ reviewStatus: 1, semesterId: 1 });

// Pre-save middleware to set review status based on absence and reason
attendanceRecordSchema.pre('save', function(next) {
  // If absent and student adds reason, set to Pending
  if (this.status === 'Absent' && this.reasonStudent && this.reviewStatus === 'Not Applicable') {
    this.reviewStatus = 'Pending';
  }
  
  // If not absent, review is not applicable
  if (this.status !== 'Absent') {
    this.reviewStatus = 'Not Applicable';
    this.reasonStudent = null;
  }
  
  next();
});

export default mongoose.model('AttendanceRecord', attendanceRecordSchema);



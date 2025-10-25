/**
 * Attendance Model
 * Stores daily attendance records for classes
 * Simplified structure for mark and edit functionality
 */

import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  rollNumber: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    trim: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
    default: 'present'
  }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  date: {
    type: String, // "YYYY-MM-DD" format
    required: true,
    trim: true,
    index: true
  },
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
    index: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  records: [attendanceRecordSchema],
  totalStudents: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  totalPresent: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  totalAbsent: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'finalized', 'modified'],
    default: 'finalized'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for unique attendance per class per date
attendanceSchema.index({ classId: 1, date: 1 }, { unique: true });

// Index for faculty queries
attendanceSchema.index({ facultyId: 1, date: -1 });

// Auto-calculate totals before saving
attendanceSchema.pre('save', function(next) {
  if (this.records && this.records.length > 0) {
    this.totalStudents = this.records.length;
    this.totalPresent = this.records.filter(record => record.status === 'present').length;
    this.totalAbsent = this.records.filter(record => record.status === 'absent').length;
  } else {
    this.totalStudents = 0;
    this.totalPresent = 0;
    this.totalAbsent = 0;
  }
  next();
});

// Also calculate totals before validation
attendanceSchema.pre('validate', function(next) {
  if (this.records && this.records.length > 0) {
    this.totalStudents = this.records.length;
    this.totalPresent = this.records.filter(record => record.status === 'present').length;
    this.totalAbsent = this.records.filter(record => record.status === 'absent').length;
  } else {
    this.totalStudents = 0;
    this.totalPresent = 0;
    this.totalAbsent = 0;
  }
  next();
});

// Virtual for attendance percentage
attendanceSchema.virtual('attendancePercentage').get(function() {
  if (this.totalStudents === 0) return 0;
  return Math.round((this.totalPresent / this.totalStudents) * 100 * 100) / 100;
});

// Ensure virtual fields are included in JSON output
attendanceSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Attendance', attendanceSchema);
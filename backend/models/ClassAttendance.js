/**
 * Class Attendance Model
 * Stores daily attendance records for entire classes
 * Follows PRD requirements for faculty-class-date uniqueness
 */

import mongoose from 'mongoose';

const classAttendanceSchema = new mongoose.Schema({
  // Core identifiers
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
    index: true
  },
  classId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Student lists (store only roll numbers for performance)
  presentStudents: [{
    type: String,
    trim: true
  }],
  absentStudents: [{
    type: String,
    trim: true
  }],
  
  // Auto-calculated totals
  totalStudents: {
    type: Number,
    required: true,
    min: 0
  },
  totalPresent: {
    type: Number,
    required: true,
    min: 0
  },
  totalAbsent: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Metadata
  batch: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
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
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'finalized', 'modified'],
    default: 'finalized'
  },
  
  // Notes
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
});

// Ensure date is normalized to UTC midnight
classAttendanceSchema.pre('save', function(next) {
  if (this.date instanceof Date) {
    this.date.setUTCHours(0, 0, 0, 0);
  }
  next();
});

// Validate totals match actual counts
classAttendanceSchema.pre('save', function(next) {
  const actualPresent = this.presentStudents.length;
  const actualAbsent = this.absentStudents.length;
  const actualTotal = actualPresent + actualAbsent;
  
  // Auto-calculate totals if they don't match
  this.totalPresent = actualPresent;
  this.totalAbsent = actualAbsent;
  this.totalStudents = actualTotal;
  
  next();
});

// Unique constraint: one record per faculty + class + date
classAttendanceSchema.index(
  { facultyId: 1, classId: 1, date: 1 }, 
  { unique: true, name: 'unique_faculty_class_date' }
);

// Performance indexes
classAttendanceSchema.index({ facultyId: 1, date: -1 }); // For faculty history
classAttendanceSchema.index({ classId: 1, date: -1 }); // For class history
classAttendanceSchema.index({ date: -1 }); // For date-based queries

// Validation
classAttendanceSchema.pre('validate', function(next) {
  // Ensure no duplicate roll numbers between present and absent
  const presentSet = new Set(this.presentStudents);
  const absentSet = new Set(this.absentStudents);
  
  for (const rollNumber of this.presentStudents) {
    if (absentSet.has(rollNumber)) {
      return next(new Error('Student cannot be both present and absent'));
    }
  }
  
  for (const rollNumber of this.absentStudents) {
    if (presentSet.has(rollNumber)) {
      return next(new Error('Student cannot be both present and absent'));
    }
  }
  
  next();
});

// Virtual for attendance percentage
classAttendanceSchema.virtual('attendancePercentage').get(function() {
  if (this.totalStudents === 0) return 0;
  return Math.round((this.totalPresent / this.totalStudents) * 100 * 100) / 100; // Round to 2 decimal places
});

// Ensure virtual fields are included in JSON output
classAttendanceSchema.set('toJSON', { virtuals: true });

export default mongoose.model('ClassAttendance', classAttendanceSchema);
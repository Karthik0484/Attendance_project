import mongoose from 'mongoose';
import DEPARTMENTS from '../config/departments.js';

const semesterSchema = new mongoose.Schema({
  semesterNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
    validate: {
      validator: Number.isInteger,
      message: 'Semester number must be an integer between 1 and 8'
    }
  },
  batchYear: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{4}$/, 'Batch year must be in format YYYY-YYYY (e.g., 2022-2026)'],
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true,
    enum: DEPARTMENTS
  },
  section: {
    type: String,
    required: true,
    enum: ['A', 'B'],
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalWorkingDays: {
    type: Number,
    default: 0,
    min: 0
  },
  academicYear: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate semesters
semesterSchema.index(
  { batchYear: 1, department: 1, section: 1, semesterNumber: 1 },
  { unique: true }
);

// Index for querying active semesters
semesterSchema.index({ isActive: 1, batchYear: 1, department: 1 });

// Virtual for semester display name
semesterSchema.virtual('displayName').get(function() {
  return `Semester ${this.semesterNumber} - ${this.batchYear} - ${this.section}`;
});

// Ensure virtuals are included in JSON output
semesterSchema.set('toJSON', { virtuals: true });
semesterSchema.set('toObject', { virtuals: true });

export default mongoose.model('Semester', semesterSchema);



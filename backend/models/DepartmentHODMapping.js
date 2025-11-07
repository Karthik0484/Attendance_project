import mongoose from 'mongoose';
import DEPARTMENTS from '../config/departments.js';

const departmentHODMappingSchema = new mongoose.Schema({
  departmentId: {
    type: String,
    required: true,
    enum: DEPARTMENTS,
    index: true
  },
  hodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'principal'],
    required: true,
    default: 'principal'
  },
  assignedOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deactivatedOn: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound index to ensure one active HOD per department
departmentHODMappingSchema.index({ departmentId: 1, status: 1 });

// Index for fast lookup of active HODs
departmentHODMappingSchema.index({ hodId: 1, status: 1 });

// Static method to get active HOD for a department
departmentHODMappingSchema.statics.getActiveHOD = async function(departmentId) {
  return await this.findOne({ 
    departmentId, 
    status: 'active' 
  }).populate('hodId', 'name email department role status').populate('assignedBy', 'name email');
};

// Static method to deactivate HOD
departmentHODMappingSchema.methods.deactivate = async function(deactivatedBy, notes = '') {
  this.status = 'inactive';
  this.deactivatedBy = deactivatedBy;
  this.deactivatedOn = new Date();
  if (notes) {
    this.notes = notes;
  }
  return await this.save();
};

const DepartmentHODMapping = mongoose.model('DepartmentHODMapping', departmentHODMappingSchema);

export default DepartmentHODMapping;


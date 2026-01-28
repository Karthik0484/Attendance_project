import mongoose from 'mongoose';

const approvalRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'HOD_CHANGE',
      'OD_REQUEST',
      'SPECIAL_HOLIDAY',
      'LEAVE_EXCEPTION',
      'ATTENDANCE_EDIT',
      'FACULTY_HOLIDAY_REQUEST'
    ],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  requestedByRole: {
    type: String,
    required: true,
    enum: ['admin', 'principal', 'hod', 'faculty', 'system']
  },
  requestedOn: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Request-specific details (varies by type)
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Attachments (files, documents)
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Approval information
  approval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedOn: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedOn: Date,
    remarks: String,
    ipAddress: String
  },
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Audit trail
  auditLog: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    remarks: String,
    ipAddress: String
  }],
  // Expiry for pending requests (optional)
  expiresAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
approvalRequestSchema.index({ type: 1, status: 1, requestedOn: -1 });
approvalRequestSchema.index({ requestedBy: 1, status: 1 });
approvalRequestSchema.index({ status: 1, priority: 1, requestedOn: -1 });
approvalRequestSchema.index({ 'approval.approvedBy': 1, 'approval.approvedOn': -1 });

// Generate unique request ID
approvalRequestSchema.pre('save', async function(next) {
  if (!this.requestId) {
    const prefix = this.type.substring(0, 3).toUpperCase();
    const count = await mongoose.model('ApprovalRequest').countDocuments({ type: this.type });
    this.requestId = `${prefix}-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Method to add audit log entry
approvalRequestSchema.methods.addAuditLog = function(action, performedBy, oldValue, newValue, remarks, ipAddress) {
  this.auditLog.push({
    action,
    performedBy,
    oldValue,
    newValue,
    remarks,
    ipAddress,
    performedAt: new Date()
  });
  return this.save();
};

// Static method to get pending requests count by type
approvalRequestSchema.statics.getPendingCounts = async function() {
  const counts = await this.aggregate([
    {
      $match: { status: 'pending' }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    HOD_CHANGE: 0,
    OD_REQUEST: 0,
    SPECIAL_HOLIDAY: 0,
    LEAVE_EXCEPTION: 0,
    ATTENDANCE_EDIT: 0,
    FACULTY_HOLIDAY_REQUEST: 0
  };
  
  counts.forEach(item => {
    result[item._id] = item.count;
  });
  
  return result;
};

// Static method to get dashboard metrics
approvalRequestSchema.statics.getDashboardMetrics = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [pending, approvedToday, rejectedToday, totalThisMonth] = await Promise.all([
    this.countDocuments({ status: 'pending' }),
    this.countDocuments({
      status: 'approved',
      'approval.approvedOn': { $gte: today, $lt: tomorrow }
    }),
    this.countDocuments({
      status: 'rejected',
      'approval.rejectedOn': { $gte: today, $lt: tomorrow }
    }),
    this.countDocuments({
      requestedOn: { $gte: startOfMonth }
    })
  ]);
  
  return {
    pending,
    approvedToday,
    rejectedToday,
    totalThisMonth
  };
};

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);

export default ApprovalRequest;


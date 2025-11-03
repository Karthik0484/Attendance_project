import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Support both old (facultyId) and new (userId) notification systems
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: false,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  title: {
    type: String,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['holiday', 'absence_reason', 'attendance', 'semester', 'system', 'announcement'],
    required: true,
    index: true
  },
  department: {
    type: String,
    enum: ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'],
    required: false
  },
  classRef: {
    type: String, // classId format: batch_year_semester_section
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  actionUrl: {
    type: String,
    default: null
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Broadcast ID - groups notifications sent together in one action
  broadcastId: {
    type: String,
    required: false,
    index: true
  },
  // Notification Status (for sender's view)
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'recalled'],
    default: 'sent',
    index: true
  },
  // Archive flag (for sender's history management)
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  // Scheduled send time (for scheduled notifications)
  scheduledFor: {
    type: Date,
    default: null
  },
  // Recall information
  recallInfo: {
    recalledAt: Date,
    recallReason: String,
    recalledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: true
  }
}, {
  timestamps: true
});

// Custom validation: at least one of facultyId or userId must be present
notificationSchema.pre('validate', function(next) {
  if (!this.facultyId && !this.userId) {
    this.invalidate('userId', 'Either facultyId or userId must be provided');
  }
  next();
});

// Index for efficient queries
notificationSchema.index({ facultyId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ facultyId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ department: 1, createdAt: -1 });
notificationSchema.index({ sentBy: 1, createdAt: -1 });
notificationSchema.index({ sentBy: 1, status: 1, isArchived: 1 }); // For sender's notification management
notificationSchema.index({ broadcastId: 1 }); // For grouping broadcast notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired notifications

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  try {
    const notification = new this(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Static method to get unread count for faculty (legacy)
notificationSchema.statics.getUnreadCount = async function(facultyId) {
  try {
    return await this.countDocuments({ facultyId, read: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to get unread count for user (new)
notificationSchema.statics.getUnreadCountForUser = async function(userId) {
  try {
    return await this.countDocuments({ userId, read: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to mark all as read for faculty (legacy)
notificationSchema.statics.markAllAsRead = async function(facultyId) {
  try {
    await this.updateMany({ facultyId, read: false }, { read: true });
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
};

// Static method to mark all as read for user (new)
notificationSchema.statics.markAllAsReadForUser = async function(userId) {
  try {
    await this.updateMany({ userId, read: false }, { read: true });
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

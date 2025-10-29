import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  facultyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
    index: true
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

// Index for efficient queries
notificationSchema.index({ facultyId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ facultyId: 1, type: 1, createdAt: -1 });
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

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(facultyId) {
  try {
    return await this.countDocuments({ facultyId, read: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(facultyId) {
  try {
    await this.updateMany({ facultyId, read: false }, { read: true });
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;


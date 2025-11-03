import express from 'express';
import Notification from '../models/Notification.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @desc    Get notifications for a user (supports both old facultyId and new userId)
// @route   GET /api/notifications
// @access  Authenticated users (faculty, students, etc.)
router.get('/', async (req, res) => {
  try {
    const { unread, type, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;

    // Try to get faculty record (for old notifications) - only for faculty users
    const faculty = req.user.role !== 'student' 
      ? await Faculty.findOne({ userId, status: 'active' })
      : null;

    // Build query - support both old (facultyId) and new (userId) notifications
    const query = {
      $or: [
        { userId: userId }, // New system: user-based notifications
        ...(faculty ? [{ facultyId: faculty._id }] : []) // Old system: faculty-based notifications
      ]
    };
    
    if (unread === 'true') {
      query.read = false;
    }
    
    if (type) {
      query.type = type;
    }

    // Get notifications with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate('sentBy', 'name role')
        .lean(),
      Notification.countDocuments(query)
    ]);

    // Get unread count for both systems
    const unreadQuery = {
      ...query,
      read: false
    };
    const unreadCount = await Notification.countDocuments(unreadQuery);

    console.log(`✅ Fetched ${notifications.length} notifications for user ${req.user.name} (${req.user.role})`);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Authenticated users (faculty, students, etc.)
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user._id;
    const faculty = req.user.role !== 'student' 
      ? await Faculty.findOne({ userId, status: 'active' })
      : null;

    // Build query for both old and new notification systems
    const query = {
      $or: [
        { userId: userId },
        ...(faculty ? [{ facultyId: faculty._id }] : [])
      ],
      read: false
    };

    const unreadCount = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: { unreadCount }
    });

  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Authenticated users (faculty, students, etc.)
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const faculty = req.user.role !== 'student' 
      ? await Faculty.findOne({ userId, status: 'active' })
      : null;

    // Find notification that belongs to this user (either by userId or facultyId)
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { userId: userId },
          ...(faculty ? [{ facultyId: faculty._id }] : [])
        ]
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    console.log(`✅ Marked notification ${id} as read`);

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Authenticated users (faculty, students, etc.)
router.patch('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user._id;
    const faculty = req.user.role !== 'student' 
      ? await Faculty.findOne({ userId, status: 'active' })
      : null;

    // Update all notifications for this user (both old and new systems)
    await Notification.updateMany(
      {
        $or: [
          { userId: userId },
          ...(faculty ? [{ facultyId: faculty._id }] : [])
        ],
        read: false
      },
      { read: true }
    );

    console.log(`✅ Marked all notifications as read for user ${req.user.name}`);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Authenticated users (faculty, students, etc.)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const faculty = req.user.role !== 'student' 
      ? await Faculty.findOne({ userId, status: 'active' })
      : null;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      $or: [
        { userId: userId },
        ...(faculty ? [{ facultyId: faculty._id }] : [])
      ]
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    console.log(`✅ Deleted notification ${id}`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

export default router;


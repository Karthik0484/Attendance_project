import express from 'express';
import Notification from '../models/Notification.js';
import Faculty from '../models/Faculty.js';
import { authenticate, facultyAndAbove } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @desc    Get notifications for a faculty member
// @route   GET /api/notifications
// @access  Faculty and above
router.get('/', facultyAndAbove, async (req, res) => {
  try {
    const { unread, type, limit = 10, page = 1 } = req.query;
    const userId = req.user._id;

    // Get faculty record
    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    // Build query
    const query = { facultyId: faculty._id };
    
    if (unread === 'true') {
      query.read = false;
    }
    
    if (type) {
      query.type = type;
    }

    // Get notifications with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Notification.countDocuments(query),
      Notification.getUnreadCount(faculty._id)
    ]);

    console.log(`✅ Fetched ${notifications.length} notifications for faculty ${faculty.name}`);

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
// @access  Faculty and above
router.get('/unread-count', facultyAndAbove, async (req, res) => {
  try {
    const userId = req.user._id;

    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    const unreadCount = await Notification.getUnreadCount(faculty._id);

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
// @access  Faculty and above
router.patch('/:id/read', facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, facultyId: faculty._id },
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
// @access  Faculty and above
router.patch('/mark-all-read', facultyAndAbove, async (req, res) => {
  try {
    const userId = req.user._id;

    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    await Notification.markAllAsRead(faculty._id);

    console.log(`✅ Marked all notifications as read for faculty ${faculty.name}`);

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
// @access  Faculty and above
router.delete('/:id', facultyAndAbove, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const faculty = await Faculty.findOne({ userId, status: 'active' });
    
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty profile not found'
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      facultyId: faculty._id
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


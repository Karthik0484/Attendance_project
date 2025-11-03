import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const StudentNotificationCard = ({ compact = false }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiFetch({
        url: '/api/notifications?limit=5',
        method: 'GET'
      });

      if (response.data.success) {
        setNotifications(response.data.data.notifications || []);
        setError('');
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await apiFetch({
        url: '/api/notifications/unread-count',
        method: 'GET'
      });

      if (response.data.success) {
        setUnreadCount(response.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiFetch({
        url: `/api/notifications/${notificationId}/read`,
        method: 'PATCH'
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
      // Update unread count
      if (unreadCount > 0) {
        setUnreadCount(prev => prev - 1);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch({
        url: '/api/notifications/mark-all-read',
        method: 'PATCH'
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return 'Today';
    } else if (isYesterday) {
      return 'Yesterday';
    } else {
      const diffTime = Math.abs(today - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
      }
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-gray-600 text-sm font-medium">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Don't show error card
  }

  if (notifications.length === 0 && unreadCount === 0) {
    return null; // Don't show card if no notifications
  }

  const displayNotifications = notifications.filter(n => n.status !== 'recalled');

  return (
    <div className={`relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl shadow-2xl overflow-hidden ${compact ? 'p-5' : 'p-6'}`}>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            {/* Bell Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className={`font-bold text-white ${compact ? 'text-lg' : 'text-xl'}`}>
                Notifications
              </h3>
              <p className="text-blue-100 text-xs">
                Messages from your department
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex-shrink-0 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notification Cards */}
        {displayNotifications.length > 0 ? (
          <div className="space-y-3">
            {displayNotifications.slice(0, compact ? 3 : 5).map((notification) => (
              <div
                key={notification._id}
                onClick={() => !notification.read && markAsRead(notification._id)}
                className={`bg-white/95 backdrop-blur-sm rounded-lg p-4 border border-white/50 hover:bg-white transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer group ${
                  !notification.read ? 'ring-2 ring-blue-300' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-gray-900 font-semibold text-base group-hover:text-blue-700 transition-colors flex-1">
                        {notification.title || 'Notification'}
                      </h4>
                      {!notification.read && (
                        <span className="ml-2 flex-shrink-0 bg-blue-500 text-white text-xs font-bold rounded-full w-2 h-2"></span>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap line-clamp-2">
                      {notification.message}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center space-x-3 flex-wrap">
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDate(notification.createdAt)}</span>
                      </div>
                      
                      {notification.sentBy && typeof notification.sentBy === 'object' && notification.sentBy.name && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>From: {notification.sentBy.name}</span>
                        </div>
                      )}

                      {notification.type && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                          {notification.type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-6 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-600 text-sm font-medium">No notifications yet</p>
            <p className="text-gray-500 text-xs mt-1">You're all caught up!</p>
          </div>
        )}

        {/* Show more indicator */}
        {displayNotifications.length > (compact ? 3 : 5) && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
              <span>+{displayNotifications.length - (compact ? 3 : 5)} more notifications</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentNotificationCard;


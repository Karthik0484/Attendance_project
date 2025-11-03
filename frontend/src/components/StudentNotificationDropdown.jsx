import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const StudentNotificationDropdown = ({ onClose, onNotificationUpdate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const response = await apiFetch({
        url: '/api/notifications?limit=10',
        method: 'GET'
      });

      if (response.data.success) {
        setNotifications(response.data.data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiFetch({
        url: `/api/notifications/${notificationId}/read`,
        method: 'PATCH'
      });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId ? { ...notif, read: true } : notif
        )
      );
      
      if (onNotificationUpdate) {
        onNotificationUpdate();
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
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
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

  const groupNotificationsBySender = (notifications) => {
    const grouped = {
      hod: [],
      faculty: [],
      other: []
    };

    notifications.forEach(notification => {
      if (notification.sentBy && typeof notification.sentBy === 'object') {
        const role = notification.sentBy.role?.toLowerCase();
        if (role === 'hod') {
          grouped.hod.push(notification);
        } else if (role === 'faculty') {
          grouped.faculty.push(notification);
        } else {
          grouped.other.push(notification);
        }
      } else {
        grouped.other.push(notification);
      }
    });

    return grouped;
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.read && n.status !== 'recalled').length;
  const validNotifications = notifications.filter(n => n.status !== 'recalled');

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-white text-sm hover:text-blue-100 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto max-h-[500px]">
        {loadingNotifications ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading notifications...</p>
          </div>
        ) : validNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-600 text-sm font-medium">No notifications yet</p>
            <p className="text-gray-500 text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          (() => {
            const grouped = groupNotificationsBySender(validNotifications);
            const sections = [];

            if (grouped.hod.length > 0) {
              sections.push({
                title: 'From HOD',
                icon: '👔',
                notifications: grouped.hod,
                color: 'purple'
              });
            }

            if (grouped.faculty.length > 0) {
              sections.push({
                title: 'From Faculty',
                icon: '👨‍🏫',
                notifications: grouped.faculty,
                color: 'blue'
              });
            }

            if (grouped.other.length > 0) {
              sections.push({
                title: 'Other',
                icon: '📢',
                notifications: grouped.other,
                color: 'gray'
              });
            }

            return (
              <div>
                {sections.map((section, sectionIndex) => {
                  const colorClasses = {
                    purple: {
                      bg: 'bg-purple-50',
                      border: 'border-purple-100',
                      text: 'text-purple-800',
                      textLight: 'text-purple-600',
                      bgLight: 'bg-purple-100'
                    },
                    blue: {
                      bg: 'bg-blue-50',
                      border: 'border-blue-100',
                      text: 'text-blue-800',
                      textLight: 'text-blue-600',
                      bgLight: 'bg-blue-100'
                    },
                    gray: {
                      bg: 'bg-gray-50',
                      border: 'border-gray-100',
                      text: 'text-gray-800',
                      textLight: 'text-gray-600',
                      bgLight: 'bg-gray-100'
                    }
                  };
                  const colors = colorClasses[section.color] || colorClasses.gray;
                  
                  return (
                    <div key={sectionIndex} className={sectionIndex > 0 ? 'border-t border-gray-200' : ''}>
                      {/* Section Header */}
                      <div className={`px-4 py-2 ${colors.bg} border-b ${colors.border}`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{section.icon}</span>
                          <h4 className={`text-sm font-semibold ${colors.text}`}>
                            {section.title}
                          </h4>
                          <span className={`text-xs ${colors.textLight} ${colors.bgLight} px-2 py-0.5 rounded-full`}>
                            {section.notifications.length}
                          </span>
                        </div>
                      </div>

                      {/* Section Notifications */}
                      <div className="divide-y divide-gray-100">
                        {section.notifications.map((notification) => (
                          <div
                            key={notification._id}
                            className={`p-4 hover:bg-gray-50 transition-colors ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  !notification.read ? 'bg-blue-500' : 'bg-transparent'
                                }`}></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between mb-1">
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    {notification.title || 'Notification'}
                                  </h4>
                                  {!notification.read && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsRead(notification._id);
                                      }}
                                      className="ml-2 flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                                  {notification.message}
                                </p>
                                <div className="flex items-center space-x-3 text-xs text-gray-500">
                                  <span className="flex items-center space-x-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{formatDate(notification.createdAt)}</span>
                                  </span>
                                  {notification.sentBy && typeof notification.sentBy === 'object' && notification.sentBy.name && (
                                    <span className="flex items-center space-x-1">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      <span>{notification.sentBy.name}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default StudentNotificationDropdown;


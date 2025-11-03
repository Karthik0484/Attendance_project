import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';
import usePreventBodyScroll from '../hooks/usePreventBodyScroll';

const NotificationManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'history'
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showArchived, setShowArchived] = useState(false);
  const [recallModal, setRecallModal] = useState({ show: false, notificationId: null, title: '' });
  const [recallReason, setRecallReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // Track which notification is being acted upon
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetRole: 'all'
  });

  // Prevent background scrolling when recall modal is open
  usePreventBodyScroll(recallModal.show);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, showArchived]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await apiFetch({
        url: `/api/hod/notifications/history?includeArchived=${showArchived}`,
        method: 'GET'
      });

      if (response.data.success) {
        setHistory(response.data.data.notifications || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.message) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setSending(true);
      
      // Check if user is authenticated
      const token = localStorage.getItem('accessToken');
      if (!token) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const response = await apiFetch({
        url: '/api/hod/notifications',
        method: 'POST',
        data: formData
      });

      if (response.data.success) {
        showToast(response.data.message, 'success');
        setFormData({
          title: '',
          message: '',
          targetRole: 'all'
        });
        // Refresh history if on history tab
        if (activeTab === 'history') {
          fetchHistory();
        }
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      
      if (error.response?.status === 401) {
        showToast('Session expired. Please log in again.', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showToast(error.response?.data?.message || 'Failed to send notification', 'error');
      }
    } finally {
      setSending(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleArchive = async (notificationId) => {
    if (!confirm('Are you sure you want to archive this notification? It will be hidden from your history.')) {
      return;
    }

    try {
      setActionLoading(notificationId);
      const response = await apiFetch({
        url: `/api/hod/notifications/${notificationId}/archive`,
        method: 'PUT'
      });

      if (response.data.success) {
        showToast('Notification archived successfully', 'success');
        fetchHistory(); // Refresh the list
      }
    } catch (error) {
      console.error('Error archiving notification:', error);
      showToast(error.response?.data?.message || 'Failed to archive notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (notificationId) => {
    if (!confirm('Are you sure you want to permanently delete this notification? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(notificationId);
      const response = await apiFetch({
        url: `/api/hod/notifications/${notificationId}`,
        method: 'DELETE'
      });

      if (response.data.success) {
        showToast('Notification deleted successfully', 'success');
        fetchHistory(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToast(error.response?.data?.message || 'Failed to delete notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecallClick = (notificationId, title) => {
    setRecallModal({ show: true, notificationId, title });
    setRecallReason('');
  };

  const handleRecallConfirm = async () => {
    if (!recallReason.trim()) {
      showToast('Please provide a reason for recalling this notification', 'error');
      return;
    }

    try {
      setActionLoading(recallModal.notificationId);
      const response = await apiFetch({
        url: `/api/hod/notifications/${recallModal.notificationId}/recall`,
        method: 'POST',
        data: { reason: recallReason }
      });

      if (response.data.success) {
        showToast(response.data.message, 'success');
        setRecallModal({ show: false, notificationId: null, title: '' });
        setRecallReason('');
        fetchHistory(); // Refresh the list
      }
    } catch (error) {
      console.error('Error recalling notification:', error);
      showToast(error.response?.data?.message || 'Failed to recall notification', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Toast Notification */}
        {toast.show && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          } animate-fade-in`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate('/hod/dashboard')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Notification Management</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-100">
              {user.department}
            </span>
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('send')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'send'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Notification
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === 'history'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </span>
            </button>
          </div>
        </div>

        {/* Send Notification Tab */}
        {activeTab === 'send' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleSend} className="space-y-6">
              {/* Target Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Send To
                </label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {[
                    { value: 'all', label: 'All Department', icon: '👥', color: 'indigo' },
                    { value: 'faculty', label: 'Faculty Only', icon: '👨‍🏫', color: 'purple' },
                    { value: 'student', label: 'Students Only', icon: '👨‍🎓', color: 'green' },
                    { value: 'hod', label: 'HODs Only', icon: '👔', color: 'orange' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        formData.targetRole === option.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetRole"
                        value={option.value}
                        checked={formData.targetRole === option.value}
                        onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <div className="text-2xl mb-1.5">{option.icon}</div>
                        <div className={`text-sm font-medium ${
                          formData.targetRole === option.value ? 'text-indigo-700' : 'text-gray-700'
                        }`}>
                          {option.label}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Important: Department Meeting on Friday"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter your message here..."
                  rows={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-500">
                    {formData.message.length} characters
                  </p>
                </div>
              </div>

              {/* Preview */}
              {(formData.title || formData.message) && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                      {formData.title || 'Notification Title'}
                    </h4>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">
                      {formData.message || 'Your message will appear here...'}
                    </p>
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      From: {user.name} ({user.department} HOD)
                    </div>
                  </div>
                </div>
              )}

              {/* Send Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 text-sm"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Notification
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Sent Notifications</h2>
                  <p className="text-sm text-gray-500 mt-1">View all notifications you've sent</p>
                </div>
                
                {/* Show Archived Toggle */}
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Archived</span>
                </label>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Loading history...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {history.map((notification) => {
                  const status = notification.status || 'sent';
                  const isArchived = notification.isArchived;
                  const isLoading = actionLoading === notification._id;

                  return (
                    <div key={notification._id} className={`p-6 transition-colors ${isArchived ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 text-sm">
                              {notification.title}
                            </h3>
                            
                            {/* Status Badge */}
                            {status === 'recalled' && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-200">
                                🔄 RECALLED
                              </span>
                            )}
                            {status === 'draft' && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-300">
                                📝 DRAFT
                              </span>
                            )}
                            {status === 'scheduled' && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
                                ⏰ SCHEDULED
                              </span>
                            )}
                            {isArchived && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                                📦 ARCHIVED
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap">
                            {notification.message}
                          </p>
                          
                          {/* Recall Info */}
                          {status === 'recalled' && notification.recallInfo && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                              <p className="text-xs text-red-800">
                                <strong>Recall Reason:</strong> {notification.recallInfo.recallReason}
                              </p>
                              <p className="text-xs text-red-600 mt-1">
                                Recalled on {new Date(notification.recallInfo.recalledAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(notification.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium border border-indigo-100">
                              {notification.type}
                            </span>
                            {notification.recipientCount && (
                              <span className="flex items-center gap-1 text-green-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {notification.recipientCount} recipient{notification.recipientCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {notification.metadata?.targetRole && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium border border-purple-100 capitalize">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Sent to: {notification.metadata.targetRole === 'all' ? 'Everyone' : notification.metadata.targetRole}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                          {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                          ) : (
                            <>
                              {/* Delete button - only for draft/scheduled */}
                              {(status === 'draft' || status === 'scheduled') && (
                                <button
                                  onClick={() => handleDelete(notification._id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete permanently"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}

                              {/* Recall button - only for sent (not recalled) */}
                              {status === 'sent' && !isArchived && (
                                <button
                                  onClick={() => handleRecallClick(notification._id, notification.title)}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Recall this notification"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                </button>
                              )}

                              {/* Archive button - only for sent/recalled (not archived) */}
                              {(status === 'sent' || status === 'recalled') && !isArchived && (
                                <button
                                  onClick={() => handleArchive(notification._id)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Archive this notification"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No Notifications {showArchived ? '' : 'Sent'}</h3>
                <p className="text-gray-600">
                  {showArchived 
                    ? "You haven't archived any notifications yet." 
                    : "You haven't sent any notifications yet."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recall Modal */}
        {recallModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Recall Notification</h3>
                  <p className="text-sm text-gray-600">"{recallModal.title}"</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Recall *
                </label>
                <textarea
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  placeholder="e.g., Information was incorrect, Event cancelled..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recipients will be notified that this notification has been recalled.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setRecallModal({ show: false, notificationId: null, title: '' });
                    setRecallReason('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecallConfirm}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!recallReason.trim() || actionLoading}
                >
                  {actionLoading ? 'Recalling...' : 'Confirm Recall'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManagement;

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';

const PrincipalApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    totalThisMonth: 0,
    pendingByType: {}
  });
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [remarks, setRemarks] = useState('');

  const requestTypes = {
    HOD_CHANGE: { label: 'HOD Changes', icon: '🔄', color: 'blue' },
    OD_REQUEST: { label: 'OD Requests', icon: '📝', color: 'green' },
    SPECIAL_HOLIDAY: { label: 'Special Holidays', icon: '🎉', color: 'purple' },
    LEAVE_EXCEPTION: { label: 'Leave Exceptions', icon: '📌', color: 'orange' },
    ATTENDANCE_EDIT: { label: 'Attendance Edits', icon: '✏️', color: 'red' },
    FACULTY_HOLIDAY_REQUEST: { label: 'Holiday Requests', icon: '🗓', color: 'indigo' }
  };

  useEffect(() => {
    fetchMetrics();
    fetchRequests();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics();
      if (statusFilter === 'pending') {
        fetchRequests();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [activeTab, statusFilter]);

  const fetchMetrics = async () => {
    try {
      const response = await apiFetch({
        url: '/api/principal/approvals/metrics',
        method: 'GET'
      });

      if (response.data.success) {
        setMetrics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'pending' 
        ? '/api/principal/approvals/pending'
        : '/api/principal/approvals/history';
      
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        params.append('type', activeTab);
      }
      if (statusFilter !== 'pending') {
        params.append('status', statusFilter);
      }

      const response = await apiFetch({
        url: `${url}?${params.toString()}`,
        method: 'GET'
      });

      if (response.data.success) {
        setRequests(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this request?')) {
      return;
    }

    try {
      setActionLoading(requestId);
      const response = await apiFetch({
        url: `/api/principal/approvals/${requestId}/approve`,
        method: 'POST',
        data: { remarks: remarks.trim() || undefined }
      });

      if (response.data.success) {
        await fetchMetrics();
        await fetchRequests();
        setRemarks('');
        setShowDetailModal(false);
        alert('Request approved successfully!');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert(error.response?.data?.msg || 'Error approving request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) {
      return;
    }

    try {
      setActionLoading(requestId);
      const response = await apiFetch({
        url: `/api/principal/approvals/${requestId}/reject`,
        method: 'POST',
        data: { remarks: remarks.trim() || 'Request rejected' }
      });

      if (response.data.success) {
        await fetchMetrics();
        await fetchRequests();
        setRemarks('');
        setShowDetailModal(false);
        alert('Request rejected successfully!');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert(error.response?.data?.msg || 'Error rejecting request');
    } finally {
      setActionLoading(null);
    }
  };

  const viewDetails = async (requestId) => {
    try {
      const response = await apiFetch({
        url: `/api/principal/approvals/${requestId}`,
        method: 'GET'
      });

      if (response.data.success) {
        setSelectedRequest(response.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
      alert('Error loading request details');
    }
  };

  const getRequestTypeInfo = (type) => {
    return requestTypes[type] || { label: type, icon: '📋', color: 'gray' };
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-gray-400 text-white'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[priority] || styles.medium}`}>
        {priority?.toUpperCase() || 'MEDIUM'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b sticky top-0 z-10 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4 md:py-5">
            <div className="flex items-center min-w-0 flex-1">
              <button
                onClick={() => navigate('/principal/dashboard')}
                className="mr-2 sm:mr-4 p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation flex-shrink-0"
                aria-label="Go back"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-lg sm:rounded-xl flex items-center justify-center mr-2 sm:mr-4 shadow-lg flex-shrink-0">
                <span className="text-xl sm:text-2xl">✅</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">Approvals Dashboard</h1>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Review and manage institutional requests</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-yellow-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.pending}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Approved Today</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.approvedToday}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-red-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Rejected Today</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.rejectedToday}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">This Month</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.totalThisMonth}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Request Categories</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  statusFilter === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  statusFilter === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === 'all'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({metrics.pending})
            </button>
            {Object.entries(requestTypes).map(([type, info]) => {
              const count = metrics.pendingByType?.[type] || 0;
              const colorClasses = {
                blue: activeTab === type ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                green: activeTab === type ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                purple: activeTab === type ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                orange: activeTab === type ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                red: activeTab === type ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                indigo: activeTab === type ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              };
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    colorClasses[info.color] || colorClasses.blue
                  }`}
                >
                  {info.icon} <span className="hidden sm:inline">{info.label}</span> <span className="sm:hidden">{info.label.split(' ')[0]}</span> {statusFilter === 'pending' && count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 sm:p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📋</span>
            </div>
            <p className="text-gray-500 text-lg">No {statusFilter} requests found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const typeInfo = getRequestTypeInfo(request.type);
              return (
                <div
                  key={request._id}
                  className="bg-white rounded-xl shadow-md p-4 sm:p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                          {typeInfo.label} - {request.requestId}
                        </h3>
                        {getStatusBadge(request.status)}
                        {getPriorityBadge(request.priority)}
                      </div>
                      <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                        <p><span className="font-semibold">Requested by:</span> {request.requestedBy?.name || 'Unknown'}</p>
                        <p><span className="font-semibold">Date:</span> {formatDate(request.requestedOn)}</p>
                        {request.details?.department && (
                          <p><span className="font-semibold">Department:</span> {request.details.department}</p>
                        )}
                        {request.details?.reason && (
                          <p className="truncate"><span className="font-semibold">Reason:</span> {request.details.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col sm:gap-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => viewDetails(request._id)}
                            className="px-3 sm:px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => handleApprove(request._id)}
                            disabled={actionLoading === request._id}
                            className="px-3 sm:px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50"
                          >
                            {actionLoading === request._id ? '...' : '✅ Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(request._id)}
                            disabled={actionLoading === request._id}
                            className="px-3 sm:px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50"
                          >
                            {actionLoading === request._id ? '...' : '❌ Reject'}
                          </button>
                        </>
                      )}
                      {request.status !== 'pending' && (
                        <button
                          onClick={() => viewDetails(request._id)}
                          className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 sm:p-6 flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                  setRemarks('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Request ID</p>
                  <p className="font-semibold">{selectedRequest.requestId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-semibold">{getRequestTypeInfo(selectedRequest.type).label}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Priority</p>
                  {getPriorityBadge(selectedRequest.priority)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Requested By</p>
                  <p className="font-semibold">{selectedRequest.requestedBy?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{selectedRequest.requestedBy?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Requested On</p>
                  <p className="font-semibold">{formatDate(selectedRequest.requestedOn)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-bold text-gray-900 mb-2">Request Details</h3>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs sm:text-sm overflow-x-auto">
                  {JSON.stringify(selectedRequest.details, null, 2)}
                </pre>
              </div>

              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold text-gray-900 mb-2">Attachments</h3>
                  <div className="space-y-2">
                    {selectedRequest.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        📎 {att.originalName || att.filename}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Remarks (Optional)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Add any remarks for this approval/rejection..."
                  />
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleApprove(selectedRequest._id)}
                    disabled={actionLoading === selectedRequest._id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {actionLoading === selectedRequest._id ? 'Processing...' : '✅ Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedRequest._id)}
                    disabled={actionLoading === selectedRequest._id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {actionLoading === selectedRequest._id ? 'Processing...' : '❌ Reject'}
                  </button>
                </div>
              )}

              {selectedRequest.auditLog && selectedRequest.auditLog.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-bold text-gray-900 mb-2">Audit Log</h3>
                  <div className="space-y-2">
                    {selectedRequest.auditLog.map((log, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-lg text-xs">
                        <p><span className="font-semibold">{log.action}</span> by {log.performedBy?.name || 'System'}</p>
                        <p className="text-gray-500">{formatDate(log.performedAt)}</p>
                        {log.remarks && <p className="text-gray-600 mt-1">{log.remarks}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrincipalApprovals;


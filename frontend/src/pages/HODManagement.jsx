import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import { exportToExcelWithLogo } from '../utils/excelExport';

const HODManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'inactive'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [sortBy, setSortBy] = useState('department'); // 'department', 'assignedDate', 'tenure'
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, withHistory: 0 });
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentHistory, setDepartmentHistory] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    department: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHODs();
    
    // Polling for real-time sync (every 30 seconds)
    const interval = setInterval(() => {
      fetchHODs();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [statusFilter, sortBy, searchTerm, activeTab]);

  const fetchHODs = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/hod-management/hods?status=${statusFilter}&sortBy=${sortBy}&search=${encodeURIComponent(searchTerm)}`,
        method: 'GET'
      });

      if (response.data.success) {
        setDepartments(response.data.data);
        if (response.data.summary) {
          setSummary(response.data.summary);
        }
      } else {
        showToast('Failed to fetch HOD information', 'error');
      }
    } catch (error) {
      console.error('Error fetching HODs:', error);
      showToast(error.response?.data?.msg || 'Error fetching HOD information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentHistory = async (departmentId) => {
    try {
      const response = await apiFetch({
        url: `/api/hod-management/hods/${departmentId}/history`,
        method: 'GET'
      });

      if (response.data.success) {
        setDepartmentHistory(response.data.data);
        setSelectedDepartment({ department: departmentId });
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      showToast('Failed to fetch HOD history', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleAddHOD = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      mobile: '',
      department: ''
    });
    setSelectedDepartment(null);
    setShowAddModal(true);
  };

  const handleReplaceHOD = (dept) => {
    setSelectedDepartment(dept);
    setFormData({
      name: '',
      email: '',
      password: '',
      mobile: '',
      department: dept.department
    });
    setShowReplaceModal(true);
  };

  const handleEditHOD = (hod) => {
    setSelectedDepartment({ department: hod.department, hod });
    setFormData({
      name: hod.name,
      email: hod.email,
      password: '',
      mobile: hod.mobile || '',
      department: hod.department
    });
    setShowEditModal(true);
  };

  const handleDeactivateHOD = async (departmentId) => {
    if (!window.confirm(`Are you sure you want to deactivate the HOD for ${departmentId} department?`)) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiFetch({
        url: `/api/hod-management/hods/${departmentId}/deactivate`,
        method: 'PUT'
      });

      if (response.data.success) {
        showToast(`HOD deactivated successfully for ${departmentId} department`, 'success');
        fetchHODs();
      } else {
        showToast(response.data.msg || 'Failed to deactivate HOD', 'error');
      }
    } catch (error) {
      console.error('Error deactivating HOD:', error);
      showToast(error.response?.data?.msg || 'Error deactivating HOD', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/hod-management/hods/export?status=${activeTab === 'active' ? 'active' : 'all'}`,
        method: 'GET'
      });

      if (response.data.success) {
        const exportData = response.data.data;
        
        await exportToExcelWithLogo(
          exportData,
          'HODs_Report',
          activeTab === 'active' ? 'Active HODs Report' : 'All HODs Report',
          {
            reportTitle: activeTab === 'active' ? 'Active HODs Report' : 'All HODs Report',
            department: 'All Departments',
            batch: '',
            year: '',
            semester: '',
            section: '',
            dateRange: `Generated on ${new Date().toLocaleDateString('en-IN')}`,
            facultyName: user?.name || 'Principal',
            summary: {
              totalStudents: exportData.length,
              totalPresent: summary.active,
              totalAbsent: summary.inactive
            }
          }
        );

        showToast('Excel file exported successfully!', 'success');
      } else {
        showToast('Failed to export HOD data', 'error');
      }
    } catch (error) {
      console.error('Error exporting HODs:', error);
      showToast('Error exporting HOD data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.department) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    if (formData.mobile && formData.mobile.length !== 10) {
      showToast('Mobile number must be exactly 10 digits', 'error');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      setSubmitting(true);
      let response;

      if (showAddModal) {
        response = await apiFetch({
          url: '/api/hod-management/hods',
          method: 'POST',
          data: {
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password && formData.password.trim() ? formData.password.trim() : undefined,
            department: formData.department,
            mobile: formData.mobile && formData.mobile.trim() ? formData.mobile.trim() : undefined
          }
        });
      } else if (showReplaceModal) {
        response = await apiFetch({
          url: `/api/hod-management/hods/${formData.department}/replace`,
          method: 'PUT',
          data: {
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password && formData.password.trim() ? formData.password.trim() : undefined,
            mobile: formData.mobile && formData.mobile.trim() ? formData.mobile.trim() : undefined,
            deactivateOldHOD: true
          }
        });
      } else if (showEditModal) {
        response = await apiFetch({
          url: `/api/hod-management/hods/${selectedDepartment.hod.id}`,
          method: 'PUT',
          data: {
            name: formData.name.trim(),
            email: formData.email.trim(),
            mobile: formData.mobile && formData.mobile.trim() ? formData.mobile.trim() : undefined
          }
        });
      }

      if (response.data.success) {
        const message = showAddModal 
          ? `HOD created successfully for ${formData.department} department` 
          : showReplaceModal 
          ? `HOD replaced successfully for ${formData.department} department`
          : 'HOD updated successfully';
        
        showToast(message, 'success');
        
        if (response.data.data.generatedPassword) {
          setTimeout(() => {
            alert(`HOD Account ${showReplaceModal ? 'Replaced' : 'Created'} Successfully!\n\nEmail: ${formData.email}\n${showReplaceModal ? 'New ' : ''}Password: ${response.data.data.generatedPassword}\n\nPlease share these credentials with the HOD. They can now login to the dashboard.`);
          }, 500);
        } else if (showReplaceModal) {
          setTimeout(() => {
            alert(`HOD Replaced Successfully!\n\nEmail: ${formData.email}\nPassword: ${formData.password ? 'As provided' : 'Auto-generated (check response)'}\n\nThe new HOD can now login to the dashboard.`);
          }, 500);
        }

        setShowAddModal(false);
        setShowReplaceModal(false);
        setShowEditModal(false);
        setFormData({
          name: '',
          email: '',
          password: '',
          mobile: '',
          department: ''
        });
        // Refresh data after successful operation - switch to active tab if HOD was created/replaced
        if (showAddModal || showReplaceModal) {
          setActiveTab('active');
          setStatusFilter('active');
        }
        // Fetch immediately to ensure fresh data is loaded
        // The useEffect will trigger another fetch when statusFilter changes, but we also fetch here
        // to ensure immediate update
        setTimeout(() => {
          fetchHODs();
        }, 100);
      } else {
        if (response.data.errors && Array.isArray(response.data.errors)) {
          const errorMessages = response.data.errors.map(err => err.msg || err.message).join(', ');
          showToast(`Validation failed: ${errorMessages}`, 'error');
        } else {
          showToast(response.data.msg || 'Operation failed', 'error');
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
        showToast(`Validation failed: ${errorMessages}`, 'error');
      } else if (error.response?.data?.msg) {
        showToast(error.response.data.msg, 'error');
      } else {
        showToast('Operation failed. Please check your input and try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">🟢 Active</span>;
    } else if (status === 'inactive') {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">🔴 Inactive</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">🟡 Pending</span>;
  };

  const departmentsList = ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS'];

  // Filter departments based on active tab and status filter
  const displayDepartments = React.useMemo(() => {
    if (activeTab === 'active') {
      // Show departments with active HODs OR departments without any HOD assigned
      // This allows assigning HODs to vacant departments from the Active tab
      return departments.filter(dept => {
        const hasActiveHOD = dept.hasHOD && dept.hod && dept.hod.status === 'active';
        const hasNoHOD = !dept.hasHOD || !dept.hod;
        return hasActiveHOD || hasNoHOD;
      });
    } else {
      // Show departments that have inactive HODs in history OR no active HOD
      // This allows showing replaced HODs even if there's a new active one
      return departments.filter(dept => {
        // Include if has inactive HODs in history (even if there's also an active HOD)
        const hasInactiveHistory = dept.inactiveHODs && dept.inactiveHODs.length > 0;
        // Include if no active HOD at all
        const hasNoActiveHOD = !dept.hasHOD || !dept.hod || dept.hod.status !== 'active';
        return hasInactiveHistory || hasNoActiveHOD;
      });
    }
  }, [departments, activeTab]);

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 py-3 sm:py-4">
            <div className="flex items-center w-full sm:w-auto">
              <button
                onClick={() => {
                  // Navigate to the correct dashboard based on user role
                  if (user?.role === 'admin') {
                    navigate('/admin/dashboard');
                  } else if (user?.role === 'principal') {
                    navigate('/principal/dashboard');
                  } else {
                    // Fallback to home or previous page
                    navigate(-1);
                  }
                }}
                className="mr-2 sm:mr-4 p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Manage HODs</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Create and manage Head of Departments</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleExport}
                className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                disabled={loading}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden xs:inline">Export Excel</span>
                <span className="xs:hidden">Export</span>
              </button>
              <button
                onClick={handleAddHOD}
                className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add HOD</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xs:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Total Departments</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ml-2">
                <span className="text-base sm:text-xl md:text-2xl">🏢</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-100 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xs:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Active HODs</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">{summary.active}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 ml-2">
                <span className="text-base sm:text-xl md:text-2xl">✅</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-white rounded-xl shadow-sm border border-red-100 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xs:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Inactive/Vacant</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">{summary.inactive}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 ml-2">
                <span className="text-base sm:text-xl md:text-2xl">⚠️</span>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xs:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">With History</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">{summary.withHistory}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 ml-2">
                <span className="text-base sm:text-xl md:text-2xl">📋</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 sm:mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
              <button
                onClick={() => {
                  setActiveTab('active');
                  setStatusFilter('active');
                }}
                className={`relative py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'active'
                    ? 'text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${activeTab === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span className="hidden xs:inline">Active HODs</span>
                  <span className="xs:hidden">Active</span>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                    activeTab === 'active' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {summary.active}
                  </span>
                </span>
                {activeTab === 'active' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('inactive');
                  setStatusFilter('inactive');
                }}
                className={`relative py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'inactive'
                    ? 'text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${activeTab === 'inactive' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
                  <span className="hidden sm:inline">Inactive / Previous HODs</span>
                  <span className="sm:hidden">Inactive</span>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                    activeTab === 'inactive' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {summary.inactive}
                  </span>
                </span>
                {activeTab === 'inactive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            </nav>
          </div>

          {/* Filters */}
          <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center">
            <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Search by department, HOD name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2 flex-wrap w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  setStatusFilter(newFilter);
                  // Update tab based on filter selection
                  if (newFilter === 'active') {
                    setActiveTab('active');
                  } else if (newFilter === 'inactive') {
                    setActiveTab('inactive');
                  }
                }}
                className="flex-1 sm:flex-none min-w-[120px] sm:min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 sm:flex-none min-w-[140px] sm:min-w-0 px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="department">Sort by Department</option>
                <option value="assignedDate">Sort by Assigned Date</option>
                <option value="tenure">Sort by Tenure</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading HOD information...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Mobile Card View */}
            <div className="block md:hidden">
              {activeTab === 'active' ? (
                displayDepartments.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No departments found
                  </div>
                ) : (
                  displayDepartments.map((dept) => {
                    const hasNoHOD = !dept.hod || !dept.hasHOD;
                    return (
                      <div key={dept.department} className={`p-4 border-b border-gray-200 ${hasNoHOD ? 'bg-yellow-50' : ''}`}>
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{dept.department}</h3>
                          {dept.hod ? getStatusBadge(dept.hod.status) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              ⚠️ Vacant
                            </span>
                          )}
                        </div>
                        {dept.hod ? (
                          <>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-medium text-gray-600">HOD:</span> <span className="text-gray-900">{dept.hod.name}</span></div>
                              <div><span className="font-medium text-gray-600">Email:</span> <span className="text-gray-500">{dept.hod.email}</span></div>
                              <div><span className="font-medium text-gray-600">Mobile:</span> <span className="text-gray-500">{dept.hod.mobile || '-'}</span></div>
                              <div><span className="font-medium text-gray-600">Access:</span> 
                                <span className={`ml-1 inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${dept.hod.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {dept.hod.status === 'active' ? 'Full Access' : 'View-only'}
                                </span>
                              </div>
                              {dept.hod.createdByRole && (
                                <div><span className="font-medium text-gray-600">Created By:</span> 
                                  <span className={`ml-1 inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                                    dept.hod.createdByRole === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {dept.hod.createdByRole === 'admin' ? '👤 Admin' : '🎓 Principal'}
                                  </span>
                                </div>
                              )}
                              <div><span className="font-medium text-gray-600">Last Login:</span> 
                                {dept.hod.lastLogin ? (
                                  <span className="text-gray-500">
                                    {new Date(dept.hod.lastLogin).toLocaleDateString('en-IN')} at {new Date(dept.hod.lastLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Never logged in</span>
                                )}
                              </div>
                              {activeTab === 'active' && dept.hod.tenureDays !== null && (
                                <div><span className="font-medium text-gray-600">Tenure:</span> <span className="text-gray-500">{dept.hod.tenureDays} days</span></div>
                              )}
                              {dept.hod.assignedOn && (
                                <div><span className="font-medium text-gray-600">Assigned:</span> <span className="text-gray-500">{new Date(dept.hod.assignedOn).toLocaleDateString('en-IN')}</span></div>
                              )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button onClick={() => fetchDepartmentHistory(dept.department)} className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded">History</button>
                              <button onClick={() => handleEditHOD(dept.hod)} className="text-xs px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded">Edit</button>
                              <button onClick={() => handleReplaceHOD(dept)} className="text-xs px-3 py-1.5 text-yellow-600 hover:bg-yellow-50 rounded">Replace</button>
                              <button onClick={() => handleDeactivateHOD(dept.department)} disabled={submitting} className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded">Deactivate</button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setFormData({ ...formData, department: dept.department });
                              setSelectedDepartment(dept);
                              setShowAddModal(true);
                            }}
                            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                          >
                            + Assign HOD
                          </button>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                displayDepartments.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    No inactive HODs or departments without HODs found
                  </div>
                ) : (
                  displayDepartments.map((dept, deptIdx) => {
                    const hasActiveHOD = dept.hod && dept.hod.status === 'active';
                    const hasInactiveHODs = dept.inactiveHODs && dept.inactiveHODs.length > 0;
                    if (!hasInactiveHODs && hasActiveHOD) return null;
                    return (
                      <React.Fragment key={dept.department}>
                        {hasActiveHOD && hasInactiveHODs && (
                          <div className="bg-blue-50 border-b-2 border-blue-200 p-4">
                            <div className="text-sm font-semibold text-blue-700 mb-2">
                              📌 {dept.department} - Current Active HOD: {dept.hod.name}
                            </div>
                            <button onClick={() => { setActiveTab('active'); setStatusFilter('active'); }} className="text-xs text-blue-600 hover:text-blue-800 underline">
                              View Active HOD →
                            </button>
                          </div>
                        )}
                        {dept.inactiveHODs && dept.inactiveHODs.length > 0 && dept.inactiveHODs.map((inactiveHOD, hodIdx) => (
                          <div key={`${dept.department}-${hodIdx}`} className="p-4 border-b border-gray-200">
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">{dept.department}</h3>
                              {getStatusBadge('inactive')}
                            </div>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-medium text-gray-600">HOD:</span> <span className="text-gray-900">{inactiveHOD.name}</span></div>
                              {inactiveHOD.replacedBy && (
                                <div className="text-xs text-blue-600 font-medium">🔄 Replaced by: {inactiveHOD.replacedBy.name}</div>
                              )}
                              <div><span className="font-medium text-gray-600">Email:</span> <span className="text-gray-500">{inactiveHOD.email}</span></div>
                              <div><span className="font-medium text-gray-600">Mobile:</span> <span className="text-gray-500">{inactiveHOD.mobile || '-'}</span></div>
                              <div><span className="font-medium text-gray-600">Access:</span> <span className="ml-1 inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">View-only</span></div>
                              <div><span className="font-medium text-gray-600">Last Login:</span> 
                                {inactiveHOD.lastLogin ? (
                                  <span className="text-gray-500">
                                    {new Date(inactiveHOD.lastLogin).toLocaleDateString('en-IN')} at {new Date(inactiveHOD.lastLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 italic">Never logged in</span>
                                )}
                              </div>
                              {inactiveHOD.assignedOn && (
                                <div><span className="font-medium text-gray-600">Assigned:</span> <span className="text-gray-500">{new Date(inactiveHOD.assignedOn).toLocaleDateString('en-IN')}</span></div>
                              )}
                              {inactiveHOD.deactivatedOn && (
                                <div><span className="font-medium text-gray-600">Deactivated:</span> <span className="text-red-500">{new Date(inactiveHOD.deactivatedOn).toLocaleDateString('en-IN')}</span></div>
                              )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button onClick={() => fetchDepartmentHistory(dept.department)} className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded">History</button>
                              <button onClick={async () => {
                                try {
                                  setSubmitting(true);
                                  const response = await apiFetch({ url: `/api/hod-management/hods/${inactiveHOD.id}/reactivate`, method: 'PUT' });
                                  if (response.data.success) {
                                    showToast('HOD reactivated successfully', 'success');
                                    setActiveTab('active');
                                    setStatusFilter('active');
                                    fetchHODs();
                                  } else {
                                    showToast(response.data.msg || 'Failed to reactivate HOD', 'error');
                                  }
                                } catch (error) {
                                  console.error('Error reactivating HOD:', error);
                                  showToast('Error reactivating HOD', 'error');
                                } finally {
                                  setSubmitting(false);
                                }
                              }} disabled={submitting} className="text-xs px-3 py-1.5 text-green-600 hover:bg-green-50 rounded">Reactivate</button>
                            </div>
                          </div>
                        ))}
                        {(!dept.inactiveHODs || dept.inactiveHODs.length === 0) && (
                          <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">{dept.department}</h3>
                            <p className="text-sm text-gray-400 italic mb-3">No HOD assigned</p>
                            <button onClick={() => { setFormData({ ...formData, department: dept.department }); setSelectedDepartment(dept); setShowAddModal(true); }} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                              + Assign HOD
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      HOD Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                      Mobile
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                      Access
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                      Last Login
                    </th>
                    {activeTab === 'active' && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                        Tenure
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                      Assigned On
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeTab === 'active' ? (
                  // Active HODs Tab - Show departments with active HODs OR departments without HODs
                  displayDepartments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        No departments found
                      </td>
                    </tr>
                  ) : (
                    displayDepartments.map((dept) => {
                      const hasNoHOD = !dept.hod || !dept.hasHOD;
                      return (
                        <tr 
                          key={dept.department} 
                          className={`hover:bg-gray-50 ${hasNoHOD ? 'bg-yellow-50' : ''}`}
                        >
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{dept.department}</div>
                          </td>
                          <td className="px-3 md:px-6 py-4">
                            {dept.hod ? (
                              <div className="text-sm text-gray-900">{dept.hod.name}</div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">No HOD assigned</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            {dept.hod ? (
                              <div className="text-sm text-gray-500">{dept.hod.email}</div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                            {dept.hod ? (
                              <div className="text-sm text-gray-500">{dept.hod.mobile}</div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                            {dept.hod ? getStatusBadge(dept.hod.status) : (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                ⚠️ Vacant
                              </span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            {dept.hod ? (
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${dept.hod.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {dept.hod.status === 'active' ? 'Full Access' : 'View-only'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                            {dept.hod && dept.hod.lastLogin ? (
                              <div className="flex flex-col">
                                <div className="text-sm text-gray-500">{new Date(dept.hod.lastLogin).toLocaleDateString('en-IN')}</div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {new Date(dept.hod.lastLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic" title="User has not logged in yet">Never</span>
                            )}
                          </td>
                          {activeTab === 'active' && (
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                              {dept.hod?.tenureDays !== null && dept.hod?.tenureDays !== undefined ? (
                                <div className="text-sm text-gray-500">{dept.hod.tenureDays} days</div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                            {dept.hod && dept.hod.assignedOn ? (
                              <div className="text-sm text-gray-500">
                                {new Date(dept.hod.assignedOn).toLocaleDateString('en-IN')}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {dept.hod ? (
                              <div className="flex justify-end gap-1 md:gap-2 flex-wrap">
                                <button
                                  onClick={() => fetchDepartmentHistory(dept.department)}
                                  className="text-xs md:text-sm text-purple-600 hover:text-purple-900 px-1 md:px-0"
                                  title="View History"
                                >
                                  History
                                </button>
                                <button
                                  onClick={() => handleEditHOD(dept.hod)}
                                  className="text-xs md:text-sm text-blue-600 hover:text-blue-900 px-1 md:px-0"
                                  title="Edit HOD"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleReplaceHOD(dept)}
                                  className="text-xs md:text-sm text-yellow-600 hover:text-yellow-900 px-1 md:px-0"
                                  title="Replace HOD"
                                >
                                  Replace
                                </button>
                                <button
                                  onClick={() => handleDeactivateHOD(dept.department)}
                                  className="text-xs md:text-sm text-red-600 hover:text-red-900 px-1 md:px-0"
                                  title="Deactivate HOD"
                                  disabled={submitting}
                                >
                                  Deactivate
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setFormData({ ...formData, department: dept.department });
                                  setSelectedDepartment(dept);
                                  setShowAddModal(true);
                                }}
                                className="px-2 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs md:text-sm"
                                title="Assign HOD to this department"
                              >
                                + Assign
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : (
                  // Inactive HODs Tab - Show ONLY inactive HODs, departments without HODs, and inactive HOD history
                  <>
                    {displayDepartments.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === 'active' ? "10" : "9"} className="px-6 py-8 text-center text-gray-500">
                          No inactive HODs or departments without HODs found
                        </td>
                      </tr>
                    ) : (
                      displayDepartments.map((dept, deptIdx) => {
                        // Show inactive HODs even if department has an active HOD (for replaced HODs)
                        const hasActiveHOD = dept.hod && dept.hod.status === 'active';
                        const hasInactiveHODs = dept.inactiveHODs && dept.inactiveHODs.length > 0;
                        
                        // Only show if there are inactive HODs to display OR no active HOD
                        if (!hasInactiveHODs && hasActiveHOD) {
                          return null; // Skip if no inactive history and has active HOD
                        }
                        
                        return (
                          <React.Fragment key={dept.department}>
                            {/* Show active HOD info if exists (for context) - show once per department */}
                            {hasActiveHOD && hasInactiveHODs && (
                              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                                <td colSpan={activeTab === 'active' ? "10" : "9"} className="px-6 py-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                          {dept.department} - Current Active HOD
                                        </div>
                                        <div className="text-xs text-gray-600 mt-0.5">
                                          {dept.hod.name} • {dept.hod.email}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setActiveTab('active');
                                        setStatusFilter('active');
                                      }}
                                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                                    >
                                      View Active →
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {/* Inactive HODs for this department */}
                            {dept.inactiveHODs && dept.inactiveHODs.length > 0 && dept.inactiveHODs.map((inactiveHOD, hodIdx) => (
                              <tr key={`${dept.department}-${hodIdx}`} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-semibold text-gray-900">{dept.department}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="text-sm font-medium text-gray-900">{inactiveHOD.name}</div>
                                    {inactiveHOD.replacedBy && (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-md w-fit">
                                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span className="text-xs font-medium text-blue-700">
                                          Replaced by {inactiveHOD.replacedBy.name}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 hidden lg:table-cell">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-sm text-gray-700">{inactiveHOD.email}</div>
                                    {inactiveHOD.replacedBy && (
                                      <div className="text-xs text-gray-500 italic">
                                        → {inactiveHOD.replacedBy.email}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                                  <div className="text-sm text-gray-700">{inactiveHOD.mobile || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge('inactive')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                  <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">View-only</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                                  {inactiveHOD.lastLogin ? (
                                    <div className="flex flex-col gap-0.5">
                                      <div className="text-sm text-gray-700 font-medium">{new Date(inactiveHOD.lastLogin).toLocaleDateString('en-IN')}</div>
                                      <div className="text-xs text-gray-500">
                                        {new Date(inactiveHOD.lastLogin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400 italic" title="User has not logged in yet">Never</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 hidden lg:table-cell">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-sm text-gray-700">
                                      {inactiveHOD.assignedOn ? new Date(inactiveHOD.assignedOn).toLocaleDateString('en-IN') : '-'}
                                    </div>
                                    {inactiveHOD.deactivatedOn && (
                                      <div className="text-xs text-red-600 font-medium">
                                        Deactivated: {new Date(inactiveHOD.deactivatedOn).toLocaleDateString('en-IN')}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => fetchDepartmentHistory(dept.department)}
                                      className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                                      title="View complete assignment history"
                                    >
                                      History
                                    </button>
                                    <button
                                      onClick={async () => {
                                        try {
                                          setSubmitting(true);
                                          const response = await apiFetch({
                                            url: `/api/hod-management/hods/${inactiveHOD.id}/reactivate`,
                                            method: 'PUT'
                                          });
                                          if (response.data.success) {
                                            showToast('HOD reactivated successfully', 'success');
                                            setActiveTab('active');
                                            setStatusFilter('active');
                                            fetchHODs();
                                          } else {
                                            showToast(response.data.msg || 'Failed to reactivate HOD', 'error');
                                          }
                                        } catch (error) {
                                          console.error('Error reactivating HOD:', error);
                                          showToast('Error reactivating HOD', 'error');
                                        } finally {
                                          setSubmitting(false);
                                        }
                                      }}
                                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Reactivate this HOD"
                                      disabled={submitting}
                                    >
                                      Reactivate
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            
                            {/* Department without HOD (only if no inactive HODs to show) */}
                            {(!dept.inactiveHODs || dept.inactiveHODs.length === 0) && (
                              <tr className="hover:bg-gray-50">
                                <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{dept.department}</div>
                                </td>
                                <td colSpan={activeTab === 'active' ? "7" : "6"} className="px-3 md:px-6 py-4">
                                  <span className="text-sm text-gray-400 italic">No HOD assigned</span>
                                </td>
                                <td className="px-3 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => {
                                      setFormData({ ...formData, department: dept.department });
                                      setSelectedDepartment(dept);
                                      setShowAddModal(true);
                                    }}
                                    className="text-xs md:text-sm text-blue-600 hover:text-blue-900 px-2 md:px-4 py-1 md:py-2 bg-blue-50 md:bg-transparent rounded md:rounded-none hover:bg-blue-100 transition-colors"
                                  >
                                    Assign
                                  </button>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">
                HOD History - {selectedDepartment?.department || 'Department'}
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-3 sm:px-6 py-3 sm:py-4 overflow-y-auto flex-1">
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-3">
                {departmentHistory.map((record, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium text-gray-600">HOD:</span> <span className="text-gray-900">{record.hodId?.name || 'Unknown'}</span></div>
                      <div><span className="font-medium text-gray-600">Email:</span> <span className="text-gray-500 break-all">{record.hodId?.email || 'N/A'}</span></div>
                      <div><span className="font-medium text-gray-600">Status:</span> {getStatusBadge(record.status)}</div>
                      <div><span className="font-medium text-gray-600">Assigned:</span> <span className="text-gray-500">{new Date(record.assignedOn).toLocaleDateString('en-IN')}</span></div>
                      <div><span className="font-medium text-gray-600">Deactivated:</span> <span className="text-gray-500">{record.deactivatedOn ? new Date(record.deactivatedOn).toLocaleDateString('en-IN') : '-'}</span></div>
                      <div><span className="font-medium text-gray-600">Tenure:</span> <span className="text-gray-500">{record.tenureDays} days</span></div>
                      <div><span className="font-medium text-gray-600">Assigned By:</span> <span className="text-gray-500">{record.assignedBy?.name || 'Unknown'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HOD Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned On</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deactivated On</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenure</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentHistory.map((record, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.hodId?.name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.hodId?.email || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{getStatusBadge(record.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(record.assignedOn).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {record.deactivatedOn ? new Date(record.deactivatedOn).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {record.tenureDays} days
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {record.assignedBy?.name || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Replace HOD Modal */}
      {(showAddModal || showReplaceModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {showAddModal ? 'Add New HOD' : 'Replace HOD'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={showReplaceModal}
                  >
                    <option value="">Select Department</option>
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password {showAddModal || showReplaceModal ? '(optional - auto-generated if empty)' : ''}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder={showAddModal || showReplaceModal ? 'Leave empty for auto-generation' : ''} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-xs text-gray-500">(optional - must be 10 digits if provided)</span></label>
                  <input type="tel" value={formData.mobile} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, mobile: value }); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="10 digits (e.g., 9876543210)" maxLength={10} />
                  {formData.mobile && formData.mobile.length !== 10 && <p className="mt-1 text-xs text-red-600">Mobile number must be exactly 10 digits</p>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button type="button" onClick={() => { setShowAddModal(false); setShowReplaceModal(false); setFormData({ name: '', email: '', password: '', mobile: '', department: '' }); }} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm sm:text-base">Cancel</button>
                <button type="submit" disabled={submitting} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base">{submitting ? 'Processing...' : showAddModal ? 'Create HOD' : 'Replace HOD'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit HOD Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Edit HOD</h3>
            </div>
            <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile <span className="text-xs text-gray-500">(optional - must be 10 digits if provided)</span></label>
                  <input type="tel" value={formData.mobile} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, mobile: value }); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="10 digits (e.g., 9876543210)" maxLength={10} />
                  {formData.mobile && formData.mobile.length !== 10 && <p className="mt-1 text-xs text-red-600">Mobile number must be exactly 10 digits</p>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button type="button" onClick={() => { setShowEditModal(false); setFormData({ name: '', email: '', password: '', mobile: '', department: '' }); }} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm sm:text-base">Cancel</button>
                <button type="submit" disabled={submitting} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base">{submitting ? 'Updating...' : 'Update HOD'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODManagement;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import CreateUserModal from '../../components/CreateUserModal';
import FacultyList from '../../components/FacultyList';
import Footer from '../../components/Footer';
import EnhancedHODNavbar from '../../components/EnhancedHODNavbar';

const HODDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [facultyRefreshTrigger, setFacultyRefreshTrigger] = useState(0);
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    avgAttendance: 0,
    studentsPresentToday: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const response = await apiFetch({
        url: '/api/faculty/hod/dashboard-stats',
        method: 'GET'
      });

      if (response.data.success) {
        setDashboardStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleFacultyCreated = () => {
    setFacultyRefreshTrigger(prev => prev + 1);
    setShowCreateFacultyModal(false);
    fetchDashboardStats(); // Refresh stats when new faculty is created
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Navbar */}
      <EnhancedHODNavbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Overview</h2>
          <p className="text-gray-600 mt-1">Key metrics and quick actions for your department</p>
        </div>

        {/* Metrics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Department Students */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Department Students</p>
            {statsLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-blue-700">{dashboardStats.totalStudents}</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Total active students</p>
            </div>
          </div>

          {/* Faculty Members */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Faculty Members</p>
            {statsLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-purple-700">{dashboardStats.totalFaculty}</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Active teaching staff</p>
            </div>
          </div>

          {/* Department Attendance */}
          <div className={`bg-white border rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow ${
            dashboardStats.avgAttendance >= 75 ? 'border-green-200 bg-gradient-to-br from-green-50 to-white' : 
            dashboardStats.avgAttendance >= 60 ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-white' : 
            'border-red-200 bg-gradient-to-br from-red-50 to-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                dashboardStats.avgAttendance >= 75 ? 'bg-green-100' : 
                dashboardStats.avgAttendance >= 60 ? 'bg-yellow-100' : 
                'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  dashboardStats.avgAttendance >= 75 ? 'text-green-600' : 
                  dashboardStats.avgAttendance >= 60 ? 'text-yellow-600' : 
                  'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Dept. Attendance</p>
            {statsLoading ? (
              <div className="flex items-center space-x-2">
                <div className={`animate-spin rounded-full h-6 w-6 border-2 border-t-transparent ${
                  dashboardStats.avgAttendance >= 75 ? 'border-green-600' : 
                  dashboardStats.avgAttendance >= 60 ? 'border-yellow-600' : 
                  'border-red-600'
                }`}></div>
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            ) : (
              <p className={`text-3xl font-bold ${
                dashboardStats.avgAttendance >= 75 ? 'text-green-700' : 
                dashboardStats.avgAttendance >= 60 ? 'text-yellow-700' : 
                'text-red-700'
              }`}>
                {dashboardStats.avgAttendance > 0 ? `${dashboardStats.avgAttendance}%` : 'N/A'}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Overall average rate</p>
              <p className="text-sm font-semibold text-gray-700">
                {statsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  <>
                    <span className="text-lg font-bold text-indigo-600">
                      {dashboardStats.studentsPresentToday || 0}/{dashboardStats.totalStudents || 0}
                    </span>
                    <span className="text-gray-600 ml-1">students present today</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Section Divider */}
        <div className="border-t border-gray-200 my-10"></div>

        {/* Quick Actions Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Quick Actions</h2>
          <p className="text-gray-600 mt-1 text-sm">Manage all aspects of your department</p>
        </div>

        {/* Functional Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {/* Faculty Management */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-indigo-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Faculty Management</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Manage faculty members in your department</p>
              <button 
                onClick={() => setShowCreateFacultyModal(true)}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                Create Faculty
              </button>
          </div>

          {/* Student Reports */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-emerald-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Student Reports</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">View and analyze student attendance reports</p>
            <button 
              onClick={() => navigate('/hod/student-reports')}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm"
            >
              View Reports
            </button>
          </div>

          {/* Department Analytics */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-violet-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Department Analytics</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Visual dashboard with charts and trends</p>
            <button 
              onClick={() => navigate('/hod/analytics')}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl hover:bg-violet-700 transition-colors font-medium text-sm"
            >
              View Analytics
            </button>
          </div>

          {/* Attendance Defaulters */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-rose-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Attendance Defaulters</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Students below threshold with recommendations</p>
            <button 
              onClick={() => navigate('/hod/defaulters')}
              className="w-full bg-rose-600 text-white py-2.5 rounded-xl hover:bg-rose-700 transition-colors font-medium text-sm"
            >
              View Defaulters
            </button>
          </div>

          {/* Attendance Policy */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-indigo-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Attendance Policy</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Configure thresholds and auto-notifications</p>
            <button 
              onClick={() => navigate('/hod/policy')}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              Manage Policy
            </button>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-amber-200 transition-all">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 ml-3">Notifications</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Send department-wide announcements</p>
            <button 
              onClick={() => navigate('/hod/notifications')}
              className="w-full bg-amber-600 text-white py-2.5 rounded-xl hover:bg-amber-700 transition-colors font-medium text-sm"
            >
              Manage Notifications
            </button>
          </div>
        </div>

        {/* Section Divider */}
        <div className="border-t border-gray-200 my-10"></div>

        {/* Department Faculty Section */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Department Faculty</h2>
              <p className="text-gray-600 mt-1 text-sm">Manage your teaching staff and their assignments</p>
            </div>
            <button
              onClick={() => setShowCreateFacultyModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md rounded-xl px-5 py-2.5 font-medium transition-all flex items-center justify-center gap-2 sm:flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Faculty
            </button>
          </div>
          
          <FacultyList 
            refreshTrigger={facultyRefreshTrigger}
            userRole="hod"
            department={user?.department}
          />
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Create Faculty Modal */}
      <CreateUserModal
        isOpen={showCreateFacultyModal}
        onClose={() => setShowCreateFacultyModal(false)}
        onUserCreated={handleFacultyCreated}
        userRole="hod"
      />
    </div>
  );
};

export default HODDashboard;

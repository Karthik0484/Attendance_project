import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import CreateUserModal from '../../components/CreateUserModal';
import FacultyList from '../../components/FacultyList';
import Footer from '../../components/Footer';

const HODDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreateFacultyModal, setShowCreateFacultyModal] = useState(false);
  const [facultyRefreshTrigger, setFacultyRefreshTrigger] = useState(0);
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    avgAttendance: 0
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🧑‍🏫</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  HOD Dashboard
                </h1>
                <p className="text-gray-600 text-sm">Welcome back, <span className="font-semibold">{user?.name}</span></p>
                <p className="text-xs text-blue-600 font-medium">📍 {user?.department} Department</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-2.5 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Department Students */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-blue-100 text-sm font-medium mb-1">Department Students</p>
                {statsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    <span className="text-white text-sm">Loading...</span>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-white">{dashboardStats.totalStudents}</p>
                )}
              </div>
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-4xl">👥</span>
              </div>
            </div>
          </div>

          {/* Faculty Members */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-100 text-sm font-medium mb-1">Faculty Members</p>
                {statsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    <span className="text-white text-sm">Loading...</span>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-white">{dashboardStats.totalFaculty}</p>
                )}
              </div>
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-4xl">👨‍🏫</span>
              </div>
            </div>
          </div>

          {/* Department Attendance */}
          <div className={`rounded-2xl shadow-xl p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl ${
            dashboardStats.avgAttendance >= 75 ? 'bg-gradient-to-br from-green-500 to-green-600' : 
            dashboardStats.avgAttendance >= 60 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' : 
            'bg-gradient-to-br from-red-500 to-red-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white text-opacity-90 text-sm font-medium mb-1">Dept. Attendance</p>
                {statsLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    <span className="text-white text-sm">Loading...</span>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-white">
                    {dashboardStats.avgAttendance > 0 ? `${dashboardStats.avgAttendance}%` : 'N/A'}
                  </p>
                )}
              </div>
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-4xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Faculty Management */}
          <div className="group bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">👩‍🏫</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 ml-4">Faculty Management</h3>
            </div>
            <p className="text-gray-600 mb-5 text-sm leading-relaxed">Manage faculty members in your department</p>
              <button 
                onClick={() => setShowCreateFacultyModal(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                Create Faculty
              </button>
          </div>

          {/* Student Reports */}
          <div className="group bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-green-200 transform hover:-translate-y-1">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🎒</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 ml-4">Student Reports</h3>
            </div>
            <p className="text-gray-600 mb-5 text-sm leading-relaxed">View and manage student attendance reports</p>
            <button 
              onClick={() => navigate('/hod/student-reports')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
            >
              View Reports
            </button>
          </div>

          {/* Department Analytics */}
          <div className="group bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-purple-200 transform hover:-translate-y-1">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 ml-4">Department Analytics</h3>
            </div>
            <p className="text-gray-600 mb-5 text-sm leading-relaxed">Detailed analytics for your department</p>
            <button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-5 py-3 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium">
              View Analytics
            </button>
          </div>

          {/* Course Management */}
          <div className="group bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-indigo-200 transform hover:-translate-y-1">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-xl font-bold text-gray-800 ml-4">Course Management</h3>
            </div>
            <p className="text-gray-600 mb-5 text-sm leading-relaxed">Manage courses and schedules</p>
            <button className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-5 py-3 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium">
              Manage Courses
            </button>
          </div>
        </div>

        {/* Faculty Management Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center mr-3">
                <span className="text-xl">👥</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">
                Department Faculty
              </h2>
            </div>
            <button
              onClick={() => setShowCreateFacultyModal(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium transform hover:-translate-y-0.5"
            >
              ➕ Add New Faculty
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

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/apiFetch';

const PrincipalDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [totalStudents, setTotalStudents] = useState(null);
  const [totalFaculty, setTotalFaculty] = useState(null);
  const [totalDepartments, setTotalDepartments] = useState(null);
  const [avgAttendance, setAvgAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard statistics (students and faculty)
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: '/api/principal/dashboard/stats',
        method: 'GET'
      });

      if (response.data.success) {
        setTotalStudents(response.data.data.totalStudents);
        setTotalFaculty(response.data.data.totalFaculty);
        setTotalDepartments(response.data.data.totalDepartments);
        setAvgAttendance(response.data.data.avgAttendance);
      } else {
        setTotalStudents(null);
        setTotalFaculty(null);
        setTotalDepartments(null);
        setAvgAttendance(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setTotalStudents(null);
      setTotalFaculty(null);
      setTotalDepartments(null);
      setAvgAttendance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    
    // Auto-refresh every 30 seconds to keep data up-to-date
    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Format number with commas
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '--';
    return num.toLocaleString('en-IN');
  };

  // Format attendance percentage with color coding
  const formatAttendance = (attendance) => {
    if (attendance === null || attendance === undefined) return '--';
    return `${attendance}%`;
  };

  // Get attendance color based on percentage
  const getAttendanceColor = (attendance) => {
    if (attendance === null || attendance === undefined) return 'text-gray-600';
    if (attendance >= 85) return 'text-green-600';
    if (attendance >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎓</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Principal Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👥</span>
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(totalStudents)}</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <span className="text-3xl mr-3">👨‍🏫</span>
              <div>
                <p className="text-sm text-gray-600">Faculty Members</p>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(totalFaculty)}</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📚</span>
              <div>
                <p className="text-sm text-gray-600">Departments</p>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(totalDepartments)}</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Avg. Attendance</p>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <p className={`text-2xl font-bold ${getAttendanceColor(avgAttendance)}`}>
                    {formatAttendance(avgAttendance)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manage HODs */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">👔</span>
              <h3 className="text-lg font-semibold">Manage HODs</h3>
            </div>
            <p className="text-gray-600 mb-4">Create and assign Head of Departments to departments</p>
            <button 
              onClick={() => navigate('/principal/hods')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Manage HODs
            </button>
          </div>

          {/* Department Reports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">🏢</span>
              <h3 className="text-lg font-semibold">Department Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View comprehensive analytics and reports by department</p>
            <button 
              onClick={() => navigate('/principal/department-reports')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              View Reports
            </button>
          </div>

          {/* Faculty Performance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">👩‍🏫</span>
              <h3 className="text-lg font-semibold">Faculty Performance</h3>
            </div>
            <p className="text-gray-600 mb-4">Monitor faculty attendance and performance</p>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              View Performance
            </button>
          </div>

          {/* Global Analytics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📈</span>
              <h3 className="text-lg font-semibold">Global Analytics</h3>
            </div>
            <p className="text-gray-600 mb-4">Comprehensive institutional analytics</p>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              View Analytics
            </button>
          </div>

          {/* Policy Management */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📋</span>
              <h3 className="text-lg font-semibold">Policy Management</h3>
            </div>
            <p className="text-gray-600 mb-4">Manage attendance policies and rules</p>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              Manage Policies
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrincipalDashboard;

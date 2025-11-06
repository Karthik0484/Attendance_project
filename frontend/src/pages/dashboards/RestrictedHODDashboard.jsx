import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiFetch';
import EnhancedHODNavbar from '../../components/EnhancedHODNavbar';
import Footer from '../../components/Footer';

const RestrictedHODDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    avgAttendance: 0,
    studentsPresentToday: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [departmentHistory, setDepartmentHistory] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
    fetchDepartmentHistory();
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

  const fetchDepartmentHistory = async () => {
    try {
      // Fetch historical data from their active period
      const response = await apiFetch({
        url: `/api/principal/hods/${user.department}/history`,
        method: 'GET'
      });

      if (response.data.success) {
        setDepartmentHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching department history:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Navbar */}
      <EnhancedHODNavbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-28">
        {/* Restricted Access Banner */}
        <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800">
                ⚠️ Restricted Access - Read-Only Mode
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your HOD role is currently <span className="font-semibold">inactive</span>. 
                  You can view your previous records and department data, but you cannot perform any modifications.
                </p>
                <p className="mt-2">
                  This includes viewing:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Department overview and statistics</li>
                  <li>Faculty list and assignments from your active period</li>
                  <li>Attendance reports and analytics from your tenure</li>
                  <li>Historical data for handover and audit purposes</li>
                </ul>
                <p className="mt-3 font-medium">
                  To restore full access, please contact the Principal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Department Overview (Read-Only)</h2>
          <p className="text-gray-600 mt-1">View-only access to {user.department} department data</p>
        </div>

        {/* Metrics Summary Cards (Read-Only) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Department Students */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 opacity-90">
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
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 opacity-90">
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
              <p className="text-xs text-gray-500">Total faculty members</p>
            </div>
          </div>

          {/* Average Attendance */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 opacity-90">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">Average Attendance</p>
            {statsLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-600 border-t-transparent"></div>
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-green-700">{dashboardStats.avgAttendance?.toFixed(1) || 0}%</p>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Department average</p>
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Previous Tenure Information</h3>
          {departmentHistory && departmentHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Department:</span> {user.department}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-semibold">Status:</span> Inactive (Read-Only Access)
                </p>
                {departmentHistory[0]?.assignedOn && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">Assigned On:</span> {new Date(departmentHistory[0].assignedOn).toLocaleDateString('en-IN')}
                  </p>
                )}
                {departmentHistory[0]?.deactivatedOn && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">Deactivated On:</span> {new Date(departmentHistory[0].deactivatedOn).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No historical data available.</p>
          )}
        </div>

        {/* Read-Only Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="h-6 w-6 text-blue-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Read-Only Access</h4>
              <p className="text-sm text-blue-700">
                You can view department data, statistics, and reports from your active period. 
                All modification features (marking attendance, editing faculty, generating new reports) are disabled.
                For full access restoration, please contact the Principal.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RestrictedHODDashboard;


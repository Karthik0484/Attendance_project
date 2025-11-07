import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';

const DepartmentReports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [departments, setDepartments] = useState(['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'CSBS', 'AIDS']);

  // Fetch departments list from API
  const fetchDepartments = async () => {
    try {
      const response = await apiFetch({
        url: '/api/hod-management/departments',
        method: 'GET'
      });

      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Keep default list if API fails
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchReports();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, [selectedDepartment, period, startDate, endDate]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDepartment !== 'all') params.append('department', selectedDepartment);
      params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiFetch({
        url: `/api/principal/department-reports?${params.toString()}`,
        method: 'GET'
      });

      if (response.data.success) {
        setReports(response.data.data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching department reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 85) return 'text-green-600 bg-green-50';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusBadge = (percentage) => {
    if (percentage >= 85) return { text: 'Good', color: 'bg-green-100 text-green-800' };
    if (percentage >= 75) return { text: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Poor', color: 'bg-red-100 text-red-800' };
  };

  if (loading && reports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading department reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b sticky top-0 z-10 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/principal/dashboard')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <span className="text-2xl">🏢</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Department Reports</h1>
                <p className="text-gray-500 text-sm mt-1">Comprehensive analytics and insights</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b shadow-sm sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-300"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-300"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-300"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📊</span>
            </div>
            <p className="text-gray-500 text-lg">No department data available</p>
          </div>
        ) : (
          reports.map((report, index) => {
            const deptColors = {
              'CSE': { bg: 'from-blue-500 to-blue-600', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
              'IT': { bg: 'from-purple-500 to-purple-600', text: 'text-purple-600', light: 'bg-purple-50', border: 'border-purple-200' },
              'ECE': { bg: 'from-green-500 to-green-600', text: 'text-green-600', light: 'bg-green-50', border: 'border-green-200' },
              'EEE': { bg: 'from-yellow-500 to-yellow-600', text: 'text-yellow-600', light: 'bg-yellow-50', border: 'border-yellow-200' },
              'Civil': { bg: 'from-orange-500 to-orange-600', text: 'text-orange-600', light: 'bg-orange-50', border: 'border-orange-200' },
              'Mechanical': { bg: 'from-red-500 to-red-600', text: 'text-red-600', light: 'bg-red-50', border: 'border-red-200' },
              'CSBS': { bg: 'from-indigo-500 to-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-200' },
              'AIDS': { bg: 'from-pink-500 to-pink-600', text: 'text-pink-600', light: 'bg-pink-50', border: 'border-pink-200' }
            };
            const colors = deptColors[report.department] || { bg: 'from-gray-500 to-gray-600', text: 'text-gray-600', light: 'bg-gray-50', border: 'border-gray-200' };
            
            return (
              <div key={index} className="mb-12">
                {report.error ? (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 shadow-sm">
                    <p className="text-red-800 font-medium">Error loading {report.department}: {report.error}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Department Header */}
                    <div className={`bg-gradient-to-r ${colors.bg} rounded-2xl shadow-xl p-6 text-white mb-6`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-bold mb-2">{report.department}</h2>
                          <p className="text-blue-100 text-sm">Department Analytics & Insights</p>
                        </div>
                        <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                          <span className="text-4xl">🏢</span>
                        </div>
                      </div>
                    </div>
                    {/* 1. Department Overview */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                      <div className="flex items-center mb-6">
                        <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                          <span className="text-2xl">📊</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">HOD</p>
                            <span className="text-2xl">👔</span>
                          </div>
                          <p className="text-xl font-bold text-gray-900 mb-1">
                            {report.overview?.hod?.name || 'Not Assigned'}
                          </p>
                          {report.overview?.hod?.email && (
                            <p className="text-xs text-blue-600 truncate">{report.overview.hod.email}</p>
                          )}
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Students</p>
                            <span className="text-2xl">👥</span>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">
                            {report.overview?.totalStudents || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Faculty</p>
                            <span className="text-2xl">👨‍🏫</span>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">
                            {report.overview?.totalFaculty || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-2 border-yellow-200 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Classes</p>
                            <span className="text-2xl">📚</span>
                          </div>
                          <p className="text-3xl font-bold text-gray-900">
                            {report.overview?.activeClasses || 0}
                          </p>
                        </div>
                      </div>
                      {report.overview?.yearWiseStrength && Object.keys(report.overview.yearWiseStrength).length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Year-wise Strength</p>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(report.overview.yearWiseStrength).map(([year, count]) => (
                              <div key={year} className={`${colors.light} ${colors.border} border-2 rounded-lg px-4 py-2 hover:shadow-md transition-all`}>
                                <span className="text-sm font-medium text-gray-600">{year}:</span>
                                <span className="ml-2 font-bold text-gray-900 text-lg">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Today's Attendance Summary */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                      <div className="flex items-center mb-6">
                        <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                          <span className="text-2xl">📅</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Today's Attendance Summary</h2>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-all">
                          <p className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">Total</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {report.todayAttendance?.total || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 hover:shadow-lg transition-all">
                          <p className="text-sm font-semibold text-green-700 mb-2 uppercase tracking-wide">Present</p>
                          <p className="text-3xl font-bold text-green-600">
                            {report.todayAttendance?.present || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-200 hover:shadow-lg transition-all">
                          <p className="text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">Absent</p>
                          <p className="text-3xl font-bold text-red-600">
                            {report.todayAttendance?.absent || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 hover:shadow-lg transition-all">
                          <p className="text-sm font-semibold text-blue-700 mb-2 uppercase tracking-wide">OD</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {report.todayAttendance?.od || 0}
                          </p>
                        </div>
                        <div className={`rounded-xl p-6 border-2 hover:shadow-lg transition-all ${getStatusColor(report.todayAttendance?.percentage || 0)}`}>
                          <p className="text-sm font-semibold mb-2 uppercase tracking-wide">Attendance %</p>
                          <p className="text-3xl font-bold">
                            {report.todayAttendance?.percentage?.toFixed(1) || '0.0'}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 3. Weekly Trend */}
                    {report.weeklyTrend && report.weeklyTrend.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">📈</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Weekly Attendance Trend (Last 7 Days)</h2>
                        </div>
                        <div className="h-72 bg-gradient-to-t from-gray-50 to-transparent rounded-xl p-6 flex items-end justify-between gap-3">
                          {report.weeklyTrend.map((day, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group">
                              <div
                                className="w-full bg-gradient-to-t from-blue-600 to-blue-500 rounded-t-lg hover:from-blue-700 hover:to-blue-600 transition-all cursor-pointer shadow-md hover:shadow-lg relative"
                                style={{ height: `${Math.max(day.percentage, 5)}%` }}
                                title={`${day.date}: ${day.percentage.toFixed(1)}%`}
                              >
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                  {day.percentage.toFixed(1)}%
                                </div>
                              </div>
                              <p className="text-xs font-medium text-gray-600 mt-3">
                                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. Monthly Trend */}
                    {report.monthlyTrend && report.monthlyTrend.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">📊</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Monthly Attendance Trend</h2>
                        </div>
                        <div className="h-72 bg-gradient-to-t from-gray-50 to-transparent rounded-xl p-6 overflow-x-auto">
                          <div className="flex items-end justify-between gap-1 min-w-full">
                            {report.monthlyTrend.map((day, idx) => (
                              <div key={idx} className="flex-1 flex flex-col items-center min-w-[4px] group">
                                <div
                                  className="w-full bg-gradient-to-t from-green-600 to-green-500 rounded-t hover:from-green-700 hover:to-green-600 transition-all cursor-pointer shadow-md hover:shadow-lg relative"
                                  style={{ height: `${Math.max(day.percentage, 2)}%` }}
                                  title={`${day.date}: ${day.percentage.toFixed(1)}%`}
                                >
                                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                    {day.percentage.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. Class-wise Attendance */}
                    {report.classAttendance && report.classAttendance.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">🎓</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Class-wise Attendance Summary</h2>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                              <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Class</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Present</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Absent</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">OD</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Attendance %</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {report.classAttendance.map((cls, idx) => {
                                const status = getStatusBadge(cls.percentage);
                                return (
                                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                      {cls.classId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">{cls.total}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{cls.present}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">{cls.absent}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">{cls.od}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                      {cls.percentage.toFixed(1)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${status.color} shadow-sm`}>
                                        {status.text}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 6. Faculty Performance */}
                    {report.facultyPerformance && report.facultyPerformance.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">👨‍🏫</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Faculty Performance Summary</h2>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                              <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Faculty Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Classes Handled</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Attendance Records</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {report.facultyPerformance.map((faculty, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {faculty.facultyName}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                                    {faculty.classesHandled}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                                    {faculty.attendanceRecords}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 7. Student Categories */}
                    {report.studentCategories && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">👥</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Student Attendance Categories</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">High Performers</p>
                              <span className="text-2xl">⭐</span>
                            </div>
                            <p className="text-3xl font-bold text-green-600 mb-1">
                              {report.studentCategories.high || 0}
                            </p>
                            <p className="text-xs text-green-600">≥95%</p>
                          </div>
                          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-2 border-yellow-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Average</p>
                              <span className="text-2xl">📊</span>
                            </div>
                            <p className="text-3xl font-bold text-yellow-600 mb-1">
                              {report.studentCategories.average || 0}
                            </p>
                            <p className="text-xs text-yellow-600">75-94%</p>
                          </div>
                          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Low</p>
                              <span className="text-2xl">⚠️</span>
                            </div>
                            <p className="text-3xl font-bold text-orange-600 mb-1">
                              {report.studentCategories.low || 0}
                            </p>
                            <p className="text-xs text-orange-600">&lt;75%</p>
                          </div>
                          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide">Critical</p>
                              <span className="text-2xl">🚨</span>
                            </div>
                            <p className="text-3xl font-bold text-red-600 mb-1">
                              {report.studentCategories.critical || 0}
                            </p>
                            <p className="text-xs text-red-600">&lt;60%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 8. Absentee Insights */}
                    {report.absenteeInsights && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">⚠️</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Absentee & OD Insights</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-2 border-red-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide">Today's Absentees</p>
                              <span className="text-2xl">📉</span>
                            </div>
                            <p className="text-3xl font-bold text-red-600">
                              {report.absenteeInsights.todayAbsentees || 0}
                            </p>
                          </div>
                          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Repeat Absentees</p>
                              <span className="text-2xl">🔄</span>
                            </div>
                            <p className="text-3xl font-bold text-orange-600">
                              {report.absenteeInsights.repeatAbsentees || 0}
                            </p>
                          </div>
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-300 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">OD Count</p>
                              <span className="text-2xl">📋</span>
                            </div>
                            <p className="text-3xl font-bold text-blue-600">
                              {report.absenteeInsights.odCount || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 9. HOD Metrics */}
                    {report.hodMetrics && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">👔</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">HOD Metrics</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                            <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">HOD Name</p>
                            <p className="text-xl font-bold text-gray-900 mb-1">{report.hodMetrics.name}</p>
                            <p className="text-xs text-blue-600 truncate">{report.hodMetrics.email}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                            <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide mb-2">Tenure</p>
                            <p className="text-3xl font-bold text-gray-900">
                              {report.hodMetrics.tenureDays || 0}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">days</p>
                          </div>
                          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border-2 border-indigo-200">
                            <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide mb-2">Faculty Under HOD</p>
                            <p className="text-3xl font-bold text-gray-900">
                              {report.hodMetrics.facultyCount || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 10. Semester Performance */}
                    {report.semesterPerformance && report.semesterPerformance.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">📚</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Semester Performance Summary</h2>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                              <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Class</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Working Days</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Avg Attendance %</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {report.semesterPerformance.map((sem, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                    {sem.classId}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                                    {sem.workingDays}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                    {sem.avgAttendance.toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 11. Alerts & Issues */}
                    {report.alerts && report.alerts.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-shadow">
                        <div className="flex items-center mb-6">
                          <div className={`w-12 h-12 ${colors.light} rounded-xl flex items-center justify-center mr-4`}>
                            <span className="text-2xl">🚨</span>
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">Alerts & Issues</h2>
                        </div>
                        <div className="space-y-3">
                          {report.alerts.map((alert, idx) => (
                            <div
                              key={idx}
                              className={`p-5 rounded-xl border-2 shadow-sm transition-all ${
                                alert.severity === 'critical'
                                  ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300'
                                  : 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300'
                              }`}
                            >
                              <div className="flex items-start">
                                <span className="text-xl mr-3">
                                  {alert.severity === 'critical' ? '🔴' : '⚠️'}
                                </span>
                                <p className="text-sm font-semibold text-gray-900 flex-1">{alert.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

export default DepartmentReports;


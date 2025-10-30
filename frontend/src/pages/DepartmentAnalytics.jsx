import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const DepartmentAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/hod/analytics?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`,
        method: 'GET'
      });

      if (response.data.success) {
        setAnalytics(response.data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">Failed to load analytics data.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chart colors - muted and consistent
  const CHART_COLORS = {
    primary: '#6366f1',    // indigo-500
    success: '#10b981',    // emerald-500
    warning: '#f59e0b',    // amber-500
    danger: '#ef4444',     // red-500
    purple: '#8b5cf6',     // purple-500
    blue: '#3b82f6'        // blue-500
  };

  // Prepare pie chart data for attendance distribution
  const attendanceDistribution = [
    { 
      name: 'Excellent', 
      fullName: 'Excellent (≥90%)',
      value: analytics.classWiseAttendance.filter(c => c.attendancePercentage >= 90).length, 
      color: CHART_COLORS.success 
    },
    { 
      name: 'Good', 
      fullName: 'Good (75-89%)',
      value: analytics.classWiseAttendance.filter(c => c.attendancePercentage >= 75 && c.attendancePercentage < 90).length, 
      color: CHART_COLORS.blue 
    },
    { 
      name: 'Needs Attention', 
      fullName: 'Needs Attention (<75%)',
      value: analytics.classWiseAttendance.filter(c => c.attendancePercentage < 75).length, 
      color: CHART_COLORS.danger 
    }
  ].filter(item => item.value > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
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

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Department Analytics
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {user.department}
                </span>
                <span className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-gray-700">Date Range:</label>
                <input
                  type="date"
                  value={dateRange.fromDate}
                  onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="date"
                  value={dateRange.toDate}
                  onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Students */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Students</h3>
            <p className="text-3xl font-bold text-indigo-700 mb-1">{analytics.summary.totalStudents}</p>
            <p className="text-xs text-gray-500">Active students</p>
          </div>

          {/* Total Faculty */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Faculty</h3>
            <p className="text-3xl font-bold text-purple-700 mb-1">{analytics.summary.totalFaculty}</p>
            <p className="text-xs text-gray-500">Active faculty members</p>
          </div>

          {/* Department Average */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Dept. Average</h3>
            <p className="text-3xl font-bold text-green-700 mb-1">{analytics.summary.departmentAvgAttendance}%</p>
            <p className="text-xs text-gray-500">Overall attendance</p>
          </div>

          {/* Total Sessions */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Sessions</h3>
            <p className="text-3xl font-bold text-orange-700 mb-1">{analytics.summary.totalSessions}</p>
            <p className="text-xs text-gray-500">Classes conducted</p>
          </div>
        </div>

        {/* Highlights Section */}
        {analytics.highlights && analytics.highlights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Key Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.highlights.map((highlight, index) => (
                <div
                  key={index}
                  className={`bg-white border rounded-xl p-4 shadow-sm ${
                    highlight.type === 'positive' ? 'border-l-4 border-l-green-500' :
                    highlight.type === 'negative' ? 'border-l-4 border-l-red-500' :
                    'border-l-4 border-l-amber-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      highlight.type === 'positive' ? 'bg-green-50' :
                      highlight.type === 'negative' ? 'bg-red-50' :
                      'bg-amber-50'
                    }`}>
                      <span className="text-xl">{highlight.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-relaxed">{highlight.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section Divider */}
        <div className="border-t border-gray-200 my-8"></div>

        {/* Charts Section */}
        <div className="space-y-6 mb-8">
          {/* Top Row - Two Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class-wise Attendance Bar Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Class-wise Attendance</h2>
                <p className="text-sm text-gray-500 mt-1">Performance breakdown by class</p>
              </div>
              {analytics.classWiseAttendance && analytics.classWiseAttendance.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={analytics.classWiseAttendance.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="classId" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Bar 
                      dataKey="attendancePercentage" 
                      fill={CHART_COLORS.primary}
                      radius={[8, 8, 0, 0]}
                      name="Attendance %" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">No data available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance Distribution Pie Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Attendance Distribution</h2>
                <p className="text-sm text-gray-500 mt-1">Classes by performance category</p>
              </div>
              {attendanceDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={attendanceDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {attendanceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      formatter={(value, name, props) => [value, props.payload.fullName]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    <p className="text-sm">No data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row - Two More Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trends Line Chart */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Monthly Trends</h2>
                <p className="text-sm text-gray-500 mt-1">Attendance progression over time</p>
              </div>
              {analytics.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={analytics.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '14px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="attendancePercentage" 
                      stroke={CHART_COLORS.success}
                      strokeWidth={3}
                      dot={{ fill: CHART_COLORS.success, r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Attendance %" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p className="text-sm">No trend data available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top Performing Faculty */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Top Performing Faculty</h2>
                <p className="text-sm text-gray-500 mt-1">Faculty with highest attendance rates</p>
              </div>
              {analytics.facultyPerformance.topPerformers && analytics.facultyPerformance.topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {analytics.facultyPerformance.topPerformers.slice(0, 5).map((faculty, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-emerald-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-lg font-bold text-emerald-700">#{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{faculty.facultyName}</p>
                          <p className="text-xs text-gray-600">
                            {faculty.classesHandled} {faculty.classesHandled > 1 ? 'classes' : 'class'} • {faculty.totalSessions} sessions
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xl font-bold text-emerald-600">{faculty.avgAttendance}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-sm">No faculty data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section Divider */}
        {analytics.lowPerformingClasses && analytics.lowPerformingClasses.length > 0 && (
          <div className="border-t border-gray-200 my-8"></div>
        )}

        {/* Classes Needing Attention */}
        {analytics.lowPerformingClasses && analytics.lowPerformingClasses.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Classes Needing Attention</h2>
                  <p className="text-sm text-gray-500 mt-1">Classes with attendance below department standards</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-100">
                  {analytics.lowPerformingClasses.length} {analytics.lowPerformingClasses.length > 1 ? 'classes' : 'class'}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attendance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sessions</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Absent</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {analytics.lowPerformingClasses.map((cls, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{cls.classId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
                          cls.attendancePercentage >= 75 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                          'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                          {cls.attendancePercentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {cls.totalSessions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-emerald-600">{cls.totalPresent}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-red-600">{cls.totalAbsent}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentAnalytics;

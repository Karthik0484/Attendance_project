import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const DefaultersList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState({
    threshold: 75,
    classId: ''
  });
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchDefaulters();
  }, [filters]);

  const fetchClasses = async () => {
    try {
      const response = await apiFetch({
        url: '/api/faculty/hod/classes-with-students',
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setClasses(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchDefaulters = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.threshold) params.append('threshold', filters.threshold);
      if (filters.classId) params.append('classId', filters.classId);

      const response = await apiFetch({
        url: `/api/hod/defaulters?${params.toString()}`,
        method: 'GET'
      });

      if (response.data.success) {
        setData(response.data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching defaulters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data || !data.defaulters || data.defaulters.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = data.defaulters.map(student => ({
      'Roll Number': student.rollNumber,
      'Student Name': student.name,
      'Email': student.email,
      'Class': student.classId,
      'Total Sessions': student.totalSessions,
      'Attended': student.attendedSessions,
      'Absent': student.absentSessions,
      'Attendance %': student.attendancePercentage
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Defaulters');

    XLSX.writeFile(wb, `Defaulters_${user.department}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredDefaulters = data?.defaulters?.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading defaulters...</p>
        </div>
      </div>
    );
  }

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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Attendance Defaulters</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-100">
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

        {/* Filters */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filter Defaulters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attendance Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={filters.threshold}
                onChange={(e) => setFilters({ ...filters, threshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Class
              </label>
              <select
                value={filters.classId}
                onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              >
                <option value="">All Classes ({classes.length})</option>
                {classes.map(cls => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Student
              </label>
              <input
                type="text"
                placeholder="Name, Roll No, or Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Defaulters</h3>
            <p className="text-3xl font-bold text-red-700 mb-1">{data?.totalDefaulters || 0}</p>
            <p className="text-xs text-gray-500">Below {filters.threshold}%</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Critical Cases</h3>
            <p className="text-3xl font-bold text-orange-700 mb-1">{data?.summary?.critical || 0}</p>
            <p className="text-xs text-gray-500">Below 60%</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Warning Cases</h3>
            <p className="text-3xl font-bold text-yellow-700 mb-1">{data?.summary?.warning || 0}</p>
            <p className="text-xs text-gray-500">60% - {filters.threshold}%</p>
          </div>
        </div>

        {/* AI Recommendations */}
        {data?.aiRecommendations && data.aiRecommendations.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800">AI-Generated Recommendations</h2>
              <p className="text-sm text-gray-500 mt-1">Automated insights and suggested actions</p>
            </div>
            <div className="space-y-3">
              {data.aiRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-4 ${
                    rec.severity === 'critical' ? 'bg-red-50 border-l-4 border-l-red-500' :
                    rec.severity === 'warning' ? 'bg-yellow-50 border-l-4 border-l-yellow-500' :
                    'bg-blue-50 border-l-4 border-l-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      rec.severity === 'critical' ? 'bg-red-100' :
                      rec.severity === 'warning' ? 'bg-yellow-100' :
                      'bg-blue-100'
                    }`}>
                      <span className="text-xl">{rec.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm mb-1">{rec.message}</p>
                      {rec.action && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Recommended Action:</span> {rec.action}
                        </p>
                      )}
                      {rec.students && rec.students.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-600 mb-1">Affected students:</p>
                          <div className="flex flex-wrap gap-2">
                            {rec.students.map((name, i) => (
                              <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defaulters Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Defaulters List</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Showing {filteredDefaulters.length} of {data?.totalDefaulters || 0} students
                </p>
              </div>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </button>
            </div>
          </div>

          {filteredDefaulters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Roll No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredDefaulters.map((student, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.classId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 font-medium">{student.attendedSessions}P</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-red-600 font-medium">{student.absentSessions}A</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-gray-600 font-medium">{student.totalSessions}T</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
                          student.attendancePercentage < 60
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                        }`}>
                          {student.attendancePercentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.attendancePercentage < 60 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                            Critical
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            Warning
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Defaulters Found!</h3>
              <p className="text-gray-600">
                {searchTerm
                  ? 'No students match your search criteria.'
                  : `All students are above ${filters.threshold}% attendance threshold.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DefaultersList;

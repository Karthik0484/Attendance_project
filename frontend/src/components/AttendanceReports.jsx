/**
 * Attendance Reports Component
 * Generates and displays attendance reports
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import LoadingSpinner from './LoadingSpinner';

const AttendanceReports = ({ classInfo, onError }) => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(true);

  const loadReport = async () => {
    if (!classInfo) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        classId: classInfo.classId
      });

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await apiFetch({
        url: `/api/attendance-management/report?${params}`,
        method: 'GET'
      });

      if (response.data.success) {
        setReportData(response.data.data);
      } else {
        onError(response.data.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      onError('Error generating report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [classInfo, filters]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerateReport = () => {
    loadReport();
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const csvContent = [
      ['Roll Number', 'Name', 'Email', 'Total Days', 'Present Days', 'Absent Days', 'Attendance %'],
      ...reportData.studentReports.map(student => [
        student.rollNumber,
        student.name,
        student.email,
        student.totalDays,
        student.presentDays,
        student.absentDays,
        student.attendancePercentage
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${classInfo.classId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getAttendanceStatus = (percentage) => {
    if (percentage >= 90) return { status: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (percentage >= 80) return { status: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (percentage >= 70) return { status: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    if (percentage >= 60) return { status: 'Below Average', color: 'text-orange-600', bg: 'bg-orange-100' };
    return { status: 'Poor', color: 'text-red-600', bg: 'bg-red-100' };
  };

  if (loading && !reportData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Report Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end space-x-2">
              <button
                onClick={handleGenerateReport}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <button
                onClick={() => setFilters({ startDate: '', endDate: '' })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {!showFilters && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowFilters(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Show Filters
          </button>
        </div>
      )}

      {/* Report Summary */}
      {reportData && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Attendance Report</h3>
              <div className="flex space-x-2">
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Class Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Total Students</div>
                <div className="text-2xl font-bold text-blue-900">{reportData.classInfo.totalStudents}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Total Days</div>
                <div className="text-2xl font-bold text-green-900">{reportData.classInfo.totalDays}</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Total Present</div>
                <div className="text-2xl font-bold text-purple-900">{reportData.summary.totalPresentCount}</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Class Average</div>
                <div className="text-2xl font-bold text-orange-900">{reportData.classInfo.classAttendancePercentage}%</div>
              </div>
            </div>

            {/* Student Reports Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Absent Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.studentReports.map((student) => {
                    const status = getAttendanceStatus(student.attendancePercentage);
                    return (
                      <tr key={student.rollNumber} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {student.totalDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {student.presentDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {student.absentDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.attendancePercentage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.color}`}>
                            {status.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Statistics Summary */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Attendance Distribution</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Excellent (90%+)</span>
                    <span className="font-medium">
                      {reportData.studentReports.filter(s => s.attendancePercentage >= 90).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Good (80-89%)</span>
                    <span className="font-medium">
                      {reportData.studentReports.filter(s => s.attendancePercentage >= 80 && s.attendancePercentage < 90).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average (70-79%)</span>
                    <span className="font-medium">
                      {reportData.studentReports.filter(s => s.attendancePercentage >= 70 && s.attendancePercentage < 80).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Below Average (60-69%)</span>
                    <span className="font-medium">
                      {reportData.studentReports.filter(s => s.attendancePercentage >= 60 && s.attendancePercentage < 70).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Poor (&lt;60%)</span>
                    <span className="font-medium">
                      {reportData.studentReports.filter(s => s.attendancePercentage < 60).length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Top Performers</h4>
                <div className="space-y-1 text-sm">
                  {reportData.studentReports
                    .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
                    .slice(0, 3)
                    .map((student, index) => (
                      <div key={student.rollNumber} className="flex justify-between">
                        <span>{index + 1}. {student.rollNumber}</span>
                        <span className="font-medium">{student.attendancePercentage}%</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Needs Attention</h4>
                <div className="space-y-1 text-sm">
                  {reportData.studentReports
                    .filter(s => s.attendancePercentage < 70)
                    .sort((a, b) => a.attendancePercentage - b.attendancePercentage)
                    .slice(0, 3)
                    .map((student, index) => (
                      <div key={student.rollNumber} className="flex justify-between">
                        <span>{index + 1}. {student.rollNumber}</span>
                        <span className="font-medium text-red-600">{student.attendancePercentage}%</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Data</h3>
            <p className="text-gray-600">Generate a report to view attendance statistics</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReports;

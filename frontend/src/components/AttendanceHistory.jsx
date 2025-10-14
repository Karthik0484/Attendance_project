/**
 * Attendance History Component
 * Displays attendance history for a class
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import LoadingSpinner from './LoadingSpinner';

const AttendanceHistory = ({ classInfo, onError }) => {
  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (classInfo) {
      loadAttendanceHistory();
    }
  }, [classInfo, filters]);

  const loadAttendanceHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        classId: classInfo.classId,
        page: filters.page,
        limit: filters.limit
      });

      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await apiFetch({
        url: `/api/attendance-management/history?${params}`,
        method: 'GET'
      });

      if (response.data.success) {
        setAttendanceRecords(response.data.data.records);
        setPagination(response.data.data.pagination);
      } else {
        onError(response.data.message || 'Failed to load attendance history');
      }
    } catch (error) {
      console.error('Error loading attendance history:', error);
      onError('Error loading attendance history');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const handleViewDetails = async (record) => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/attendance-management/details?classId=${encodeURIComponent(classInfo.classId)}&date=${record.date.split('T')[0]}`,
        method: 'GET'
      });

      if (response.data.success) {
        setSelectedRecord(response.data.data);
        setShowDetails(true);
      } else {
        onError(response.data.message || 'Failed to load attendance details');
      }
    } catch (error) {
      console.error('Error loading attendance details:', error);
      onError('Error loading attendance details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canEditRecord = (recordDate) => {
    const recordDateObj = new Date(recordDate);
    const today = new Date();
    const daysDifference = Math.floor((today - recordDateObj) / (1000 * 60 * 60 * 24));
    return daysDifference <= 7;
  };

  if (loading && attendanceRecords.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
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
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ startDate: '', endDate: '', page: 1, limit: 20 })}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance History ({pagination.total} records)
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No attendance records found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(record.date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatTime(record.createdAt)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {record.totalPresent}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {record.totalAbsent}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.attendancePercentage}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        record.status === 'finalized' 
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'modified'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(record)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View Details
                      </button>
                      {canEditRecord(record.date) && (
                        <span className="text-green-600 text-xs">Editable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {pagination.current} of {pagination.pages} ({pagination.total} total records)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current === pagination.pages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attendance Details Modal */}
      {showDetails && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Attendance Details - {formatDate(selectedRecord.attendance.date)}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Present Students */}
                <div>
                  <h4 className="text-lg font-medium text-green-600 mb-3">
                    Present Students ({selectedRecord.presentStudents.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedRecord.presentStudents.map((student) => (
                      <div key={student.rollNumber} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <div>
                          <div className="font-medium text-gray-900">{student.rollNumber}</div>
                          <div className="text-sm text-gray-600">{student.name}</div>
                        </div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Absent Students */}
                <div>
                  <h4 className="text-lg font-medium text-red-600 mb-3">
                    Absent Students ({selectedRecord.absentStudents.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedRecord.absentStudents.map((student) => (
                      <div key={student.rollNumber} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <div>
                          <div className="font-medium text-gray-900">{student.rollNumber}</div>
                          <div className="text-sm text-gray-600">{student.name}</div>
                        </div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedRecord.attendance.notes && (
                <div className="mt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">{selectedRecord.attendance.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;

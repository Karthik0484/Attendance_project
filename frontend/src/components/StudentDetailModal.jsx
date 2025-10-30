import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import usePreventBodyScroll from '../hooks/usePreventBodyScroll';

const StudentDetailModal = ({ studentId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Prevent background scrolling when modal is open
  usePreventBodyScroll(!!studentId);

  useEffect(() => {
    fetchStudentDetails();
  }, [studentId, fromDate, toDate]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      
      const response = await apiFetch({
        url: `/api/faculty/hod/student-reports/${studentId}?${params.toString()}`,
        method: 'GET'
      });

      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching student details:', error);
      alert('Failed to fetch student details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return status === 'present' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBadge = (status) => {
    return status === 'present'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Excellent':
        return 'text-green-600';
      case 'Good':
        return 'text-yellow-600';
      case 'Poor':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Student Attendance Details</h2>
              {data && (
                <div className="text-blue-100 text-sm space-y-1">
                  <p>Roll Number: {data.student.rollNumber}</p>
                  <p>Email: {data.student.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading student details...</p>
            </div>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="text-blue-600 text-sm font-medium mb-1">Total Sessions</div>
                <div className="text-3xl font-bold text-blue-700">{data.attendance.totalSessions}</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="text-green-600 text-sm font-medium mb-1">Present</div>
                <div className="text-3xl font-bold text-green-700">{data.attendance.totalPresent}</div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                <div className="text-red-600 text-sm font-medium mb-1">Absent</div>
                <div className="text-3xl font-bold text-red-700">{data.attendance.totalAbsent}</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="text-purple-600 text-sm font-medium mb-1">Attendance</div>
                <div className={`text-3xl font-bold ${getCategoryColor(data.attendance.category)}`}>
                  {data.attendance.attendancePercentage}%
                </div>
                <div className="text-xs text-purple-600 mt-1">{data.attendance.category}</div>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">💡</span>
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 mb-2">Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-yellow-700 font-medium">Max Consecutive Absences:</span>
                      <span className="ml-2 font-bold text-yellow-900">{data.insights.maxConsecutiveAbsences}</span>
                    </div>
                    <div>
                      <span className="text-yellow-700 font-medium">Current Streak:</span>
                      <span className="ml-2 font-bold text-yellow-900">{data.insights.currentConsecutiveAbsences}</span>
                    </div>
                    <div>
                      <span className="text-yellow-700 font-medium">Last Attendance:</span>
                      <span className="ml-2 font-bold text-yellow-900">
                        {data.insights.lastAttendanceDate ? new Date(data.insights.lastAttendanceDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Filter */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-gray-800 mb-3">Filter by Date Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="From Date"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="To Date"
                />
                <button
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Attendance Records Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">Attendance Records ({data.records.length})</h3>
              </div>

              {data.records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Class
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Faculty
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reason / Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.records.map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.classId}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {record.facultyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(record.status)}`}>
                              {record.status === 'present' ? '✓ Present' : '✗ Absent'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {record.reason && (
                              <div className="mb-1">
                                <span className="font-medium">Student: </span>
                                {record.reason}
                              </div>
                            )}
                            {record.facultyNote && (
                              <div>
                                <span className="font-medium">Faculty: </span>
                                {record.facultyNote}
                              </div>
                            )}
                            {!record.reason && !record.facultyNote && (
                              <span className="text-gray-400">No remarks</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <p>No attendance records found for the selected date range.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <p className="text-gray-600">Failed to load student details</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;


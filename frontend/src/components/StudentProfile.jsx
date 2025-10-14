import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';

const StudentProfile = ({ onToast }) => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  useEffect(() => {
    fetchStudentProfile();
  }, [studentId]);

  const fetchStudentProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Fetching student profile for ID:', studentId);
      
      const response = await apiFetch({
        url: `/api/students/${studentId}/profile-detailed`,
        method: 'GET'
      });

      if (response.data.success) {
        setStudentData(response.data.data);
        console.log('✅ Student profile loaded successfully');
      } else {
        throw new Error(response.data.message || 'Failed to fetch student profile');
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load student profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'text-green-600 bg-green-100';
      case 'Absent': return 'text-red-600 bg-red-100';
      case 'Holiday': return 'text-blue-600 bg-blue-100';
      case 'Not Marked': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 85) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toISOString().slice(0, 7); // YYYY-MM format
  };

  const getAvailableMonths = () => {
    if (!studentData?.monthlyAttendance) return [];
    return Object.keys(studentData.monthlyAttendance).sort().reverse();
  };

  const renderMonthlyCalendar = (monthKey) => {
    if (!studentData?.monthlyAttendance?.[monthKey]) return null;
    
    const monthData = studentData.monthlyAttendance[monthKey];
    const monthDate = new Date(monthKey + '-01');
    const monthName = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    
    // Get first day of month and number of days
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Create calendar grid
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="h-8"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${day.toString().padStart(2, '0')}`;
      const dayData = monthData.find(d => d.date === dateStr);
      const status = dayData?.status || 'Not Marked';
      
      calendarDays.push(
        <div
          key={day}
          className={`h-8 w-8 flex items-center justify-center text-sm rounded cursor-pointer hover:bg-gray-100 ${getStatusColor(status)}`}
          title={dayData ? `${status}${dayData.reason ? ' - ' + dayData.reason : ''}` : status}
        >
          {day}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{monthName}</h3>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
          {calendarDays}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 rounded"></div>
            <span className="text-sm text-gray-600">Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 rounded"></div>
            <span className="text-sm text-gray-600">Absent</span>
                  </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span className="text-sm text-gray-600">Holiday</span>
                  </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span className="text-sm text-gray-600">Not Marked</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Student Not Found</h2>
          <p className="text-gray-600 mb-4">The requested student profile could not be found.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { student, academic, attendanceStats, recentAttendance, monthlyAttendance } = studentData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                <p className="text-sm text-gray-500">
                  {student.rollNumber} • {student.department} • {student.batchYear}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Student Info
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Personal & Academic Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-gray-900">{student.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{student.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Mobile</label>
                  <p className="text-gray-900">{student.mobile}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Parent Contact</label>
                  <p className="text-gray-900">{student.parentContact}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-gray-900">{student.address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                  <p className="text-gray-900">{formatDate(student.dateOfBirth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                  <p className="text-gray-900">{student.emergencyContact}</p>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Academic Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Roll Number</label>
                  <p className="text-gray-900 font-mono">{student.rollNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <p className="text-gray-900">{student.department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Batch Year</label>
                  <p className="text-gray-900">{student.batchYear}</p>
                    </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Section</label>
                  <p className="text-gray-900">{student.section}</p>
                  </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Semesters</label>
                  <p className="text-gray-900">{academic.totalSemesters}</p>
                    </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    student.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {student.status}
                  </span>
                  </div>
                    </div>
                  </div>
                  
            {/* Semester Details */}
            {academic.semesters && academic.semesters.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Semester Enrollments</h2>
                <div className="space-y-3">
                  {academic.semesters.map((semester, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{semester.semesterName}</p>
                          <p className="text-sm text-gray-500">{semester.year} - Section {semester.section}</p>
                    </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          semester.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {semester.status}
                        </span>
                  </div>
                      {semester.facultyId && (
                        <p className="text-sm text-gray-500 mt-1">
                          Faculty: {semester.facultyId.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Attendance Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Attendance Overview */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Attendance Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{attendanceStats.totalDays}</div>
                  <div className="text-sm text-gray-500">Total Days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{attendanceStats.presentDays}</div>
                  <div className="text-sm text-gray-500">Present</div>
                    </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{attendanceStats.absentDays}</div>
                  <div className="text-sm text-gray-500">Absent</div>
                    </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getAttendanceColor(attendanceStats.attendancePercentage)}`}>
                    {attendanceStats.attendancePercentage}%
                  </div>
                  <div className="text-sm text-gray-500">Attendance</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    attendanceStats.attendancePercentage >= 85 ? 'bg-green-500' :
                    attendanceStats.attendancePercentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${attendanceStats.attendancePercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Monthly Calendar View */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Monthly Calendar View</h2>
                <select
                  value={selectedMonth || getCurrentMonth()}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  {getAvailableMonths().map(month => (
                    <option key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
              {renderMonthlyCalendar(selectedMonth || getCurrentMonth())}
            </div>

            {/* Recent Attendance */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Attendance (Last 30 Days)</h2>
              {recentAttendance && recentAttendance.length > 0 ? (
                <div className="space-y-2">
                  {recentAttendance.slice(0, 10).map((record, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {formatDate(record.date)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </div>
                      {record.reason && (
                        <span className="text-sm text-gray-500 truncate max-w-xs">
                          {record.reason}
                      </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No recent attendance records found</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal Placeholder - Will be implemented next */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Student Information</h3>
            <p className="text-gray-600 mb-4">Edit functionality will be implemented in the next step.</p>
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
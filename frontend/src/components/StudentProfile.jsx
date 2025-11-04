import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';

const StudentProfile = ({ onToast }) => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showAllRecentAttendance, setShowAllRecentAttendance] = useState(false);

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
    const normalizedStatus = status?.toLowerCase() || '';
    switch (normalizedStatus) {
      case 'present': return 'text-green-700 bg-green-100 border border-green-200';
      case 'absent': return 'text-red-700 bg-red-100 border border-red-200';
      case 'od': 
      case 'onduty': return 'text-blue-700 bg-blue-100 border border-blue-200';
      case 'holiday': return 'text-purple-700 bg-purple-100 border border-purple-200';
      case 'not marked': return 'text-gray-600 bg-gray-100 border border-gray-200';
      default: return 'text-gray-600 bg-gray-100 border border-gray-200';
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
    const monthDate = new Date(monthKey + '-01');
    const monthName = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    
    // Get first day of month and number of days
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Get attendance data for this month
    const monthData = studentData?.monthlyAttendance?.[monthKey] || [];
    const attendanceMap = new Map();
    monthData.forEach(item => {
      // Normalize date to YYYY-MM-DD format
      const normalizedDate = typeof item.date === 'string' 
        ? item.date.split('T')[0] 
        : (item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date);
      attendanceMap.set(normalizedDate, item);
    });

    // Get today's date for highlighting
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Create calendar grid
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="h-12 sm:h-14"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${day.toString().padStart(2, '0')}`;
      const dayData = attendanceMap.get(dateStr);
      const status = dayData?.status || 'Not Marked';
      const isToday = todayStr === dateStr;
      
      calendarDays.push(
        <div
          key={day}
          className={`h-12 sm:h-14 w-full flex flex-col items-center justify-center text-xs sm:text-sm rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
            isToday ? 'ring-2 ring-blue-500 ring-offset-2 z-10' : ''
          } ${getStatusColor(status)}`}
          title={dayData ? `${status}${dayData.reason ? ' - ' + dayData.reason : ''}` : status}
        >
          <span className={`font-bold ${isToday ? 'text-blue-700' : ''}`}>{day}</span>
          {status !== 'Not Marked' && (
            <span className="text-[10px] sm:text-xs leading-none mt-0.5 font-bold">
              {status.toLowerCase() === 'present' ? '✓' : 
               status.toLowerCase() === 'absent' ? '✗' : 
               status.toLowerCase() === 'od' ? '🔄' :
               status.toLowerCase() === 'holiday' ? '🎉' : ''}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-6">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div 
              key={day} 
              className="h-10 sm:h-12 flex items-center justify-center text-xs sm:text-sm font-bold text-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 rounded-lg border border-gray-200 shadow-sm"
            >
              {day}
            </div>
          ))}
          {calendarDays}
        </div>
        <div className="mt-6 pt-6 border-t-2 border-gray-200">
          <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
            <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-green-100 px-4 py-2.5 rounded-lg border-2 border-green-300 shadow-sm">
              <div className="w-5 h-5 bg-green-500 rounded-full shadow-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <span className="text-sm font-semibold text-green-800">Present</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-100 px-4 py-2.5 rounded-lg border-2 border-red-300 shadow-sm">
              <div className="w-5 h-5 bg-red-500 rounded-full shadow-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">✗</span>
              </div>
              <span className="text-sm font-semibold text-red-800">Absent</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-2.5 rounded-lg border-2 border-blue-300 shadow-sm">
              <div className="w-5 h-5 bg-blue-500 rounded-full shadow-md flex items-center justify-center">
                <span className="text-white text-xs">🔄</span>
              </div>
              <span className="text-sm font-semibold text-blue-800">OD</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-2.5 rounded-lg border-2 border-purple-300 shadow-sm">
              <div className="w-5 h-5 bg-purple-500 rounded-full shadow-md flex items-center justify-center">
                <span className="text-white text-xs">🎉</span>
              </div>
              <span className="text-sm font-semibold text-purple-800">Holiday</span>
            </div>
            <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-2.5 rounded-lg border-2 border-gray-300 shadow-sm">
              <div className="w-5 h-5 bg-gray-400 rounded-full shadow-md"></div>
              <span className="text-sm font-semibold text-gray-700">Not Marked</span>
            </div>
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

  // Check if current user is the student (can edit own profile)
  // The studentId from URL can be either User _id or Student _id
  // If user is a student, they can always edit their own profile
  const canEdit = user?.role === 'student';

  const handleEditSuccess = () => {
    setToast({ show: true, message: 'Profile updated successfully!', type: 'success' });
    fetchStudentProfile(); // Refresh profile data
    setShowEditModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
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
            {canEdit && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Student Info
              </button>
            )}
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
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg border border-blue-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Attendance Overview
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 text-center transform hover:scale-105 transition-transform">
                  <div className="text-3xl font-bold text-gray-800 mb-1">{attendanceStats.totalDays || 0}</div>
                  <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Total Days</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 shadow-md border border-green-200 text-center transform hover:scale-105 transition-transform">
                  <div className="text-3xl font-bold text-green-700 mb-1">{attendanceStats.presentDays || 0}</div>
                  <div className="text-xs font-medium text-green-700 uppercase tracking-wide">Present</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 shadow-md border border-blue-200 text-center transform hover:scale-105 transition-transform">
                  <div className="text-3xl font-bold text-blue-700 mb-1">{attendanceStats.odDays || 0}</div>
                  <div className="text-xs font-medium text-blue-700 uppercase tracking-wide">OD</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 shadow-md border border-red-200 text-center transform hover:scale-105 transition-transform">
                  <div className="text-3xl font-bold text-red-700 mb-1">{attendanceStats.absentDays || 0}</div>
                  <div className="text-xs font-medium text-red-700 uppercase tracking-wide">Absent</div>
                </div>
                <div className={`rounded-lg p-4 shadow-md border text-center transform hover:scale-105 transition-transform ${
                  attendanceStats.attendancePercentage >= 85 
                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200' 
                    : attendanceStats.attendancePercentage >= 75
                    ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                    : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                }`}>
                  <div className={`text-3xl font-bold mb-1 ${
                    attendanceStats.attendancePercentage >= 85 
                      ? 'text-green-700' 
                      : attendanceStats.attendancePercentage >= 75
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    {attendanceStats.attendancePercentage || 0}%
                  </div>
                  <div className={`text-xs font-medium uppercase tracking-wide ${
                    attendanceStats.attendancePercentage >= 85 
                      ? 'text-green-700' 
                      : attendanceStats.attendancePercentage >= 75
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    Attendance
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      attendanceStats.attendancePercentage >= 85 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                      attendanceStats.attendancePercentage >= 75 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${Math.min(attendanceStats.attendancePercentage || 0, 100)}%` }}
                  >
                    <div className="h-full w-full bg-white bg-opacity-30 animate-pulse"></div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 text-center">
                  {attendanceStats.attendancePercentage >= 85 
                    ? '✅ Excellent attendance!' 
                    : attendanceStats.attendancePercentage >= 75
                    ? '⚠️ Good, but can improve'
                    : '❌ Low attendance - Action required'}
                </div>
              </div>
            </div>

            {/* Monthly Calendar View */}
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Monthly Calendar View
                </h2>
                <select
                  value={selectedMonth || getCurrentMonth()}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 border border-purple-300 rounded-lg text-sm font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
                >
                  {getAvailableMonths().length > 0 ? (
                    getAvailableMonths().map(month => (
                      <option key={month} value={month}>
                        {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </option>
                    ))
                  ) : (
                    <option value={getCurrentMonth()}>
                      {new Date(getCurrentMonth() + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </option>
                  )}
                </select>
              </div>
              {renderMonthlyCalendar(selectedMonth || getCurrentMonth())}
            </div>

            {/* Recent Attendance */}
            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-xl shadow-lg border border-indigo-100 p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Attendance (Last 30 Days)
              </h2>
              {recentAttendance && recentAttendance.length > 0 ? (
                <>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {(showAllRecentAttendance ? recentAttendance : recentAttendance.slice(0, 5)).map((record, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-indigo-300"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                            record.status === 'Present' ? 'bg-gradient-to-br from-green-400 to-green-600' :
                            record.status === 'Absent' ? 'bg-gradient-to-br from-red-400 to-red-600' :
                            record.status === 'OD' || record.status === 'od' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                            record.status === 'Holiday' ? 'bg-gradient-to-br from-purple-400 to-purple-600' :
                            'bg-gradient-to-br from-gray-400 to-gray-600'
                          }`}>
                            {record.status === 'Present' ? '✓' : 
                             record.status === 'Absent' ? '✗' : 
                             record.status === 'OD' || record.status === 'od' ? '🔄' :
                             record.status === 'Holiday' ? '🎉' : '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">{formatDate(record.date)}</div>
                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                          </div>
                        </div>
                        {record.reason && (
                          <div className="text-right max-w-xs">
                            <span className="text-xs text-gray-500 italic">"{record.reason}"</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {recentAttendance.length > 5 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                      <button
                        onClick={() => setShowAllRecentAttendance(!showAllRecentAttendance)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                      >
                        <span>{showAllRecentAttendance ? 'Show Less' : `View More (${recentAttendance.length - 5} more)`}</span>
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${showAllRecentAttendance ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 font-medium">No recent attendance records found</p>
                  <p className="text-sm text-gray-400 mt-1">Attendance data will appear here once marked</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditStudentModal
          student={student}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
};

// Edit Student Modal Component
const EditStudentModal = ({ student, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    mobile: student.mobile || '',
    parentContact: student.parentContact || '',
    address: student.address || '',
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
    emergencyContact: (student.emergencyContact && typeof student.emergencyContact === 'object' && !Array.isArray(student.emergencyContact))
      ? (student.emergencyContact.phone || '') 
      : (student.emergencyContact || '')
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.mobile && !/^[0-9]{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Mobile must be exactly 10 digits';
    }

    if (formData.parentContact && !/^[0-9]{10}$/.test(formData.parentContact)) {
      newErrors.parentContact = 'Parent contact must be exactly 10 digits';
    }

    if (formData.address && formData.address.trim().length < 5) {
      newErrors.address = 'Address must be at least 5 characters';
    }

    if (formData.emergencyContact && !/^[0-9]{10}$/.test(formData.emergencyContact)) {
      newErrors.emergencyContact = 'Emergency contact must be exactly 10 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        mobile: formData.mobile || undefined,
        parentContact: formData.parentContact || undefined,
        address: formData.address || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        emergencyContact: formData.emergencyContact || undefined
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === '') {
          delete updateData[key];
        }
      });

      const response = await apiFetch({
        url: '/api/students/self/update',
        method: 'PUT',
        data: updateData
      });

      if (response.data.success) {
        onSuccess();
      } else {
        throw new Error(response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        setErrors({ general: error.response?.data?.message || 'Error updating profile. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Edit Profile Information</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.general}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.mobile ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Contact <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="parentContact"
                value={formData.parentContact}
                onChange={handleChange}
                placeholder="10-digit parent contact"
                maxLength={10}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.parentContact ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.parentContact && <p className="mt-1 text-sm text-red-600">{errors.parentContact}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact
              </label>
              <input
                type="tel"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                placeholder="10-digit emergency contact"
                maxLength={10}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.emergencyContact ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.emergencyContact && <p className="mt-1 text-sm text-red-600">{errors.emergencyContact}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              placeholder="Enter your address"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.address ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentProfile;
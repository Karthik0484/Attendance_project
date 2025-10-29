import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';
import ClassHolidayCard from './ClassHolidayCard';
import './StudentProfileDetail.css';

// Icons for better visual hierarchy
const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const GraduationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// Circular Progress Component for Attendance
const CircularProgress = ({ percentage, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (percentage) => {
    if (percentage >= 85) return '#10B981'; // Green
    if (percentage >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: getColor(percentage) }}>
          {percentage}%
        </span>
      </div>
    </div>
  );
};

// Profile Photo Placeholder Component
const ProfilePhoto = ({ name, size = 80 }) => {
  const initials = name
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const fontSize = Math.max(size * 0.4, 20); // Responsive font size

  return (
    <div 
      className="rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg"
      style={{ 
        width: size, 
        height: size,
        fontSize: fontSize
      }}
    >
      {initials}
    </div>
  );
};

// Department Badge Component
const DepartmentBadge = ({ department }) => {
  const getDepartmentColor = (dept) => {
    const colors = {
      'CSE': 'bg-blue-100 text-blue-800',
      'IT': 'bg-green-100 text-green-800',
      'ECE': 'bg-purple-100 text-purple-800',
      'EEE': 'bg-yellow-100 text-yellow-800',
      'Civil': 'bg-orange-100 text-orange-800',
      'Mechanical': 'bg-red-100 text-red-800',
      'CSBS': 'bg-indigo-100 text-indigo-800',
      'AIDS': 'bg-pink-100 text-pink-800'
    };
    return colors[dept] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDepartmentColor(department)}`}>
      {department}
    </span>
  );
};

// Helper function to get current semester
const getCurrentSemester = (student) => {
  // First check if student has a direct semester field
  if (student.semester) {
    return student.semester;
  }
  
  // Check if student has semesters array and find the current one
  if (student.semesters && student.semesters.length > 0) {
    // Find the most recent semester or the one marked as current
    const currentSemester = student.semesters.find(sem => sem.isCurrent) || 
                           student.semesters[student.semesters.length - 1];
    return currentSemester.semesterName || currentSemester.semester || 'N/A';
  }
  
  // Check if student has classAssigned which might contain semester info
  if (student.classAssigned) {
    // Extract semester from class name if it follows a pattern like "CSE-A-Sem1-2025"
    const semesterMatch = student.classAssigned.match(/Sem\s*(\d+)/i);
    if (semesterMatch) {
      return `Sem ${semesterMatch[1]}`;
    }
  }
  
  return 'N/A';
};

// Helper function to get faculty name
const getFacultyName = (student) => {
  // First check if student has a direct facultyName field
  if (student.facultyName) {
    return student.facultyName;
  }
  
  // Check if student has facultyId and we can resolve the name
  if (student.facultyId) {
    // If facultyId is an object with name property
    if (typeof student.facultyId === 'object' && student.facultyId.name) {
      return student.facultyId.name;
    }
    // If facultyId is a string, we might need to fetch the faculty details
    // For now, return a placeholder
    return 'Faculty Assigned';
  }
  
  // Check if student has semesters array and find faculty from current semester
  if (student.semesters && student.semesters.length > 0) {
    const currentSemester = student.semesters.find(sem => sem.isCurrent) || 
                           student.semesters[student.semesters.length - 1];
    if (currentSemester.facultyId) {
      if (typeof currentSemester.facultyId === 'object' && currentSemester.facultyId.name) {
        return currentSemester.facultyId.name;
      }
      return 'Faculty Assigned';
    }
  }
  
  return 'Not assigned';
};

// Attendance Calendar Component
const AttendanceCalendar = ({ attendanceData, student, compact = false }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyData, setMonthlyData] = useState({});
  const [holidays, setHolidays] = useState([]);

  // Fetch holidays for the current month
  useEffect(() => {
    if (student) {
      fetchHolidays();
      
      // Poll for holiday updates every 30 seconds
      const interval = setInterval(() => {
        fetchHolidays();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [student, currentMonth]);

  const fetchHolidays = async () => {
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const queryParams = new URLSearchParams({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0],
        batchYear: student.batchYear,
        section: student.section,
        semester: student.semester || getCurrentSemester(student)
      });

      const response = await apiFetch({
        url: `/api/holidays/analytics?${queryParams}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setHolidays(response.data.data.holidays || []);
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  useEffect(() => {
    if (attendanceData && attendanceData.recentAttendance) {
      // Group attendance data by month
      const grouped = {};
      attendanceData.recentAttendance.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[monthKey]) {
          grouped[monthKey] = {};
        }
        const dayKey = String(date.getDate()).padStart(2, '0');
        grouped[monthKey][dayKey] = {
          status: record.status,
          reason: record.reason || ''
        };
      });

      // Add holidays to the grouped data
      holidays.forEach(holiday => {
        const date = new Date(holiday.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[monthKey]) {
          grouped[monthKey] = {};
        }
        const dayKey = String(date.getDate()).padStart(2, '0');
        // Only add holiday if there's no attendance record for that day
        if (!grouped[monthKey][dayKey]) {
          grouped[monthKey][dayKey] = {
            status: 'Holiday',
            reason: holiday.reason
          };
        }
      });

      setMonthlyData(grouped);
    }
  }, [attendanceData, holidays]);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present':
        return 'bg-green-500 text-white';
      case 'Absent':
        return 'bg-red-500 text-white';
      case 'OD':
        return 'bg-blue-500 text-white';
      case 'Holiday':
        return 'bg-purple-500 text-white';
      case 'Not Marked':
        return 'bg-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Present':
        return '✓';
      case 'Absent':
        return '✗';
      case 'OD':
        return '📋';
      case 'Holiday':
        return '🎉';
      case 'Not Marked':
        return '?';
      default:
        return '';
    }
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthData = monthlyData[currentMonthKey] || {};
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayKey = String(day).padStart(2, '0');
    const dayData = monthData[dayKey];
    days.push({
      day,
      data: dayData
    });
  }

  return (
    <div className={`space-y-4 ${compact ? 'calendar-compact' : ''}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h4 className={`font-semibold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
          {getMonthName(currentMonth)}
        </h4>
        <div className="flex space-x-2">
          <button
            onClick={() => navigateMonth(-1)}
            className={`text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors calendar-nav-btn ${compact ? 'p-1' : 'p-2'}`}
          >
            <svg className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigateMonth(1)}
            className={`text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors calendar-nav-btn ${compact ? 'p-1' : 'p-2'}`}
          >
            <svg className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 gap-1 calendar-grid ${compact ? 'gap-0.5' : 'gap-1'}`}>
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={`text-center font-medium text-gray-500 bg-gray-50 rounded ${compact ? 'p-1 text-xs' : 'p-2 text-sm'}`}>
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {days.map((dayData, index) => (
          <div key={index} className={`${compact ? 'aspect-square' : 'aspect-square'}`}>
            {dayData ? (
              <div
                className={`w-full h-full flex flex-col items-center justify-center rounded-lg font-medium calendar-day transition-all duration-200 hover:scale-110 ${
                  dayData.data
                    ? getStatusColor(dayData.data.status)
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                } ${compact ? 'text-xs' : 'text-sm'}`}
                title={dayData.data ? `${dayData.data.status}${dayData.data.reason ? ` - ${dayData.data.reason}` : ''}` : ''}
              >
                <span className={`${compact ? 'text-xs' : 'text-xs'}`}>{dayData.day}</span>
                {dayData.data && (
                  <span className={`${compact ? 'text-xs mt-0.5' : 'text-xs mt-1'}`}>
                    {getStatusIcon(dayData.data.status)}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-full h-full"></div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap justify-center gap-4 pt-4 border-t border-gray-200 calendar-legend ${compact ? 'gap-2' : 'gap-4'}`}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Present</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Absent</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>OD</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Holiday</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>Not Marked</span>
        </div>
      </div>
    </div>
  );
};

const StudentProfileDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('personal');
  const [isUpdating, setIsUpdating] = useState(false);

  console.log('🎯 StudentProfileDetail component loaded');
  console.log('🎯 Student ID from params:', studentId);
  console.log('🎯 Current URL:', window.location.href);

  const fetchStudentProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setIsUpdating(true);
      }
      
      console.log('📋 Fetching student profile for ID:', studentId);
      
      // Fetch detailed student profile with attendance
      const profileResponse = await apiFetch({
        url: `/api/students/${studentId}/profile`,
        method: 'GET'
      });

      console.log('📋 Profile response:', profileResponse.data);

      if (profileResponse.data.success) {
        console.log('📊 Student data:', profileResponse.data.data.student);
        console.log('📊 Attendance data:', profileResponse.data.data.attendanceStats);
        setStudent(profileResponse.data.data.student);
        setAttendanceData(profileResponse.data.data.attendanceStats);
        console.log('✅ Student profile loaded successfully');
        
        if (silent) {
          console.log('📡 Real-time update: Attendance data refreshed');
        }
      } else {
        console.log('❌ API returned error:', profileResponse.data);
        throw new Error(profileResponse.data.message || 'Failed to fetch student profile');
      }
    } catch (error) {
      console.error('Error fetching student profile:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      if (!silent) {
        let errorMessage = 'Error loading student profile';
        if (error.response?.status === 404) {
          errorMessage = 'Student not found';
        } else if (error.response?.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.response?.status === 403) {
          errorMessage = 'Access denied. You cannot view this student.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [studentId]);

  // Initial fetch and setup polling for real-time updates
  useEffect(() => {
    if (studentId) {
      fetchStudentProfile();
      
      // Set up polling for real-time attendance updates every 10 seconds (faster updates)
      const pollInterval = setInterval(() => {
        console.log('📡 Polling for attendance updates...');
        fetchStudentProfile(true); // Silent refresh
      }, 10000);
      
      return () => {
        console.log('🛑 Stopping attendance polling');
        clearInterval(pollInterval);
      };
    }
  }, [studentId, fetchStudentProfile]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    fetchStudentProfile(); // Refresh data
    showToast('Student information updated successfully!', 'success');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getAttendanceStatusColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student profile...</p>
          <p className="text-sm text-gray-500 mt-2">Student ID: {studentId}</p>
        </div>
      </div>
    );
  }

  if (!student) {
    console.log('❌ No student data found. Loading state:', loading);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Student Not Found</h2>
          <p className="text-gray-600 mb-6">The requested student profile could not be found.</p>
          <p className="text-sm text-gray-500 mb-4">Student ID: {studentId}</p>
          <button
            onClick={() => navigate('/class-management')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Class Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      {/* Enhanced Profile Header with Gradient Background */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 shadow-xl profile-header">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-center lg:items-start space-y-8 lg:space-y-0 lg:space-x-8">
            {/* Profile Photo */}
            <div className="flex-shrink-0 profile-photo mb-4 lg:mb-0">
              <ProfilePhoto name={student.name} size={120} />
            </div>
            
            {/* Student Info */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-3">
                    {student.name}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start space-x-4 text-blue-100">
                    <span className="text-lg font-medium">#{student.rollNumber}</span>
                    <DepartmentBadge department={student.department} />
                    <span className="text-lg">{student.batchYear}</span>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 flex items-center justify-center font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <EditIcon />
                    <span className="ml-2">Edit Profile</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border-b">
          <div className="flex flex-wrap">
            {[
              { id: 'personal', label: 'Personal Info', icon: <UserIcon /> },
              { id: 'academic', label: 'Academic Info', icon: <GraduationIcon /> },
              { id: 'attendance', label: 'Attendance', icon: <ChartIcon /> },
              { id: 'semesters', label: 'Semesters', icon: <BookIcon /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-lg">
          {activeTab === 'personal' && (
            <div className="p-8 tab-content">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <UserIcon />
                <span className="ml-3">Personal Information</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <UserIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Full Name</p>
                      <p className="text-lg text-gray-900">{student.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <EmailIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Email Address</p>
                      <p className="text-lg text-gray-900">{student.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <PhoneIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Mobile Number</p>
                      <p className="text-lg text-gray-900">{student.mobile || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <PhoneIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Parent Contact</p>
                      <p className="text-lg text-gray-900">{student.parentContact || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <LocationIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-lg text-gray-900">{student.address || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <CalendarIcon />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                      <p className="text-lg text-gray-900">{formatDate(student.dateOfBirth)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="p-8 tab-content">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <GraduationIcon />
                <span className="ml-3">Academic Information</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="academic-card academic-card-slate p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-slate-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">#</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-slate-600">Roll Number</p>
                      <p className="text-xl font-bold text-slate-900 font-mono">{student.rollNumber}</p>
                    </div>
                  </div>
                </div>
                
                <div className="academic-card academic-card-emerald p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">🏢</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-emerald-600">Department</p>
                      <p className="text-xl font-bold text-emerald-900">{student.department}</p>
                    </div>
                  </div>
                </div>
                
                <div className="academic-card academic-card-cyan p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">📅</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-cyan-600">Batch Year</p>
                      <p className="text-xl font-bold text-cyan-900">{student.batchYear}</p>
                    </div>
                  </div>
                </div>
                
                <div className="academic-card academic-card-amber p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">📚</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-amber-600">Current Semester</p>
                      <p className="text-xl font-bold text-amber-900">{getCurrentSemester(student)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="academic-card academic-card-rose p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">A</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-rose-600">Section</p>
                      <p className="text-xl font-bold text-rose-900">{student.section || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="academic-card academic-card-violet p-6 rounded-xl border card-hover">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">👨‍🏫</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-violet-600">Faculty</p>
                      <p className="text-xl font-bold text-violet-900">{getFacultyName(student)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="p-8 tab-content">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ChartIcon />
                  <span className="ml-3">Attendance Overview</span>
                </h2>
                <div className="flex items-center space-x-3">
                  {isUpdating && (
                    <div className="flex items-center space-x-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Updating...</span>
                    </div>
                  )}
                  <button
                    onClick={() => fetchStudentProfile(true)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                    title="Refresh attendance data"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Holiday Notification Card */}
              <div className="mb-8">
                <ClassHolidayCard 
                  classData={{ 
                    batch: student.batchYear, 
                    section: student.section, 
                    semester: student.semester || getCurrentSemester(student),
                    department: student.department 
                  }} 
                />
              </div>

              {attendanceData ? (
                <div className="space-y-8">
                  {/* Attendance Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-green-50 p-6 rounded-xl border border-green-200 text-center card-hover">
                      <div className="text-3xl font-bold text-green-600 mb-2">✅</div>
                      <p className="text-2xl font-bold text-green-900">{attendanceData.presentDays}</p>
                      <p className="text-sm text-green-600">Present Days</p>
                    </div>
                    <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center card-hover">
                      <div className="text-3xl font-bold text-red-600 mb-2">❌</div>
                      <p className="text-2xl font-bold text-red-900">{attendanceData.absentDays}</p>
                      <p className="text-sm text-red-600">Absent Days</p>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 text-center card-hover">
                      <div className="text-3xl font-bold text-blue-600 mb-2">📅</div>
                      <p className="text-2xl font-bold text-blue-900">{attendanceData.totalDays}</p>
                      <p className="text-sm text-blue-600">Total Working Days</p>
                    </div>
                  </div>

                  {/* Compact Calendar with Percentage */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Monthly Attendance Calendar - Compact */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                        <CalendarIcon />
                        <span className="ml-2">Monthly Calendar</span>
                      </h3>
                      <AttendanceCalendar attendanceData={attendanceData} student={student} compact={true} />
                    </div>

                    {/* Attendance Percentage & Stats */}
                    <div className="space-y-6">
                      {/* Circular Progress Chart */}
                      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-center">
                          <ChartIcon />
                          <span className="ml-2">Overall Attendance</span>
                        </h3>
                        <div className="flex justify-center mb-4">
                          <CircularProgress percentage={attendanceData.attendancePercentage} size={140} strokeWidth={10} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">✅</div>
                            <p className="text-lg font-bold text-green-900">{attendanceData.presentDays}</p>
                            <p className="text-xs text-green-600">Present</p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">❌</div>
                            <p className="text-lg font-bold text-red-900">{attendanceData.absentDays}</p>
                            <p className="text-xs text-red-600">Absent</p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Stats */}
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-blue-900 mb-3">Quick Stats</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-blue-700">Total Days:</span>
                            <span className="font-bold text-blue-900">{attendanceData.totalDays}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Attendance Rate:</span>
                            <span className="font-bold text-blue-900">{attendanceData.attendancePercentage}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">Status:</span>
                            <span className={`font-bold ${
                              attendanceData.attendancePercentage >= 85 ? 'text-green-600' :
                              attendanceData.attendancePercentage >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {attendanceData.attendancePercentage >= 85 ? 'Excellent' :
                               attendanceData.attendancePercentage >= 70 ? 'Good' : 'Needs Improvement'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Attendance History */}
                  {attendanceData.recentAttendance && attendanceData.recentAttendance.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Recent Attendance History</span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceData.recentAttendance.slice(0, 10).map((record, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {formatDate(record.date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    record.status === 'Present' 
                                      ? 'bg-green-100 text-green-800' 
                                      : record.status === 'Absent'
                                      ? 'bg-red-100 text-red-800'
                                      : record.status === 'OD'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {record.reason || 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-xl text-gray-500">No attendance data available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'semesters' && (
            <div className="p-8 tab-content">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <BookIcon />
                <span className="ml-3">Semester Enrollments</span>
              </h2>
              {student.semesters && student.semesters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {student.semesters.map((semester, index) => (
                    <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">{semester.semesterName}</h3>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {semester.year}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 w-20">Section:</span>
                          <span className="text-gray-900 font-semibold">{semester.section}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 w-20">Faculty:</span>
                          <span className="text-gray-900 font-semibold">
                            {semester.facultyId ? 'Assigned' : 'Not assigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-xl text-gray-500">No semester enrollments found</p>
                </div>
              )}
            </div>
          )}
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
    name: student.name || '',
    mobile: student.mobile || '',
    parentContact: student.parentContact || '',
    address: student.address || '',
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
    department: student.department || '',
    section: student.section || '',
    semester: student.semester || ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const response = await apiFetch({
        url: `/api/faculty/student/${student._id || student.id}/update`,
        method: 'PUT',
        data: formData
      });

      if (response.data.success) {
        onSuccess();
      } else {
        setErrors({ general: response.data.message || 'Failed to update student' });
      }
    } catch (error) {
      console.error('Error updating student:', error);
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        setErrors({ general: error.response?.data?.message || 'Error updating student' });
      }
    } finally {
      setLoading(false);
    }
  };

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

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }

    if (formData.mobile && !/^[0-9]{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Mobile number must be exactly 10 digits';
    }

    if (formData.parentContact && !/^[0-9]{10}$/.test(formData.parentContact)) {
      newErrors.parentContact = 'Parent contact must be exactly 10 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Student Information</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.mobile ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Parent Contact</label>
                <input
                  type="tel"
                  name="parentContact"
                  value={formData.parentContact}
                  onChange={handleChange}
                  placeholder="Parent's mobile number"
                  className={`mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.parentContact ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.parentContact && <p className="mt-1 text-sm text-red-600">{errors.parentContact}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter student's address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="Civil">Civil</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="CSBS">CSBS</option>
                  <option value="AIDS">AIDS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Section</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Section</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <select
                  name="semester"
                  value={formData.semester}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Semester</option>
                  <option value="Sem 1">Sem 1</option>
                  <option value="Sem 2">Sem 2</option>
                  <option value="Sem 3">Sem 3</option>
                  <option value="Sem 4">Sem 4</option>
                  <option value="Sem 5">Sem 5</option>
                  <option value="Sem 6">Sem 6</option>
                  <option value="Sem 7">Sem 7</option>
                  <option value="Sem 8">Sem 8</option>
                </select>
              </div>
            </div>

            {/* Read-only fields */}
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Non-editable Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-500">Roll Number</label>
                  <p className="text-gray-900 font-mono">{student.rollNumber}</p>
                </div>
                <div>
                  <label className="text-gray-500">Email Address</label>
                  <p className="text-gray-900">{student.email}</p>
                </div>
                <div>
                  <label className="text-gray-500">Batch Year</label>
                  <p className="text-gray-900">{student.batchYear}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileDetail;

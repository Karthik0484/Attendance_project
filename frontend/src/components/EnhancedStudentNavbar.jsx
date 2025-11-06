import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import StudentNotificationDropdown from './StudentNotificationDropdown';
import { API_BASE_URL } from '../config/apiConfig';

const EnhancedStudentNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [studentData, setStudentData] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  // Fetch student data
  const fetchStudentData = async () => {
    try {
      const response = await apiFetch({
        url: `/api/students/${user.id}/profile`,
        method: 'GET'
      });

      if (response.data.success) {
        setStudentData(response.data.data.student);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    try {
      const response = await apiFetch({
        url: '/api/notifications/unread-count',
        method: 'GET'
      });

      if (response.data.success) {
        setUnreadCount(response.data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    fetchStudentData();
    fetchUnreadCount();

    // Poll for notifications every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleViewProfile = () => {
    navigate(`/student-profile/${user.id}`);
    setShowProfileDropdown(false);
  };

  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="animate-pulse flex items-center space-x-4">
              <div className="w-14 h-14 bg-white rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-white bg-opacity-30 rounded"></div>
                <div className="h-3 w-24 bg-white bg-opacity-20 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Left Side - Profile Trigger */}
            <div className="flex items-center space-x-4">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-4 hover:bg-white hover:bg-opacity-10 rounded-lg px-3 py-2 transition-all group"
                >
                  {/* Enhanced Avatar */}
                  <div className="relative">
                    {studentData?.profilePhoto ? (
                      <img
                        src={`${API_BASE_URL}${studentData.profilePhoto}`}
                        alt="Profile"
                        className="w-14 h-14 rounded-full object-cover ring-4 ring-green-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center ring-4 ring-green-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all">
                        <span className="text-green-600 font-bold text-2xl">
                          {studentData?.name?.charAt(0) || user?.name?.charAt(0) || 'S'}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-white animate-pulse"></div>
                  </div>
                  
                  {/* User Info */}
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xl font-bold text-white group-hover:text-green-100 transition-colors">
                        {studentData?.name || user?.name || 'Student'}
                      </h4>
                      <svg className="w-4 h-4 text-green-200 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <svg className="w-4 h-4 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-sm font-medium text-green-100">
                        {studentData?.department || user?.department}
                      </p>
                      {studentData?.rollNumber && (
                        <>
                          <span className="text-green-200">•</span>
                          <p className="text-sm font-medium text-green-100">
                            {studentData.rollNumber}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-2xl overflow-hidden animate-fadeIn">
                    {/* Profile Snapshot */}
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                      <div className="flex items-center space-x-4 mb-4">
                        {studentData?.profilePhoto ? (
                          <img
                            src={`${API_BASE_URL}${studentData.profilePhoto}`}
                            alt="Profile"
                            className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-bold text-3xl">
                              {studentData?.name?.charAt(0) || 'S'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-bold">{studentData?.name || user?.name}</h3>
                          <p className="text-green-100 text-sm">Student</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-green-200">Roll Number</p>
                          <p className="font-semibold">{studentData?.rollNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-green-200">Department</p>
                          <p className="font-semibold">{studentData?.department || user?.department}</p>
                        </div>
                        {studentData?.batchYear && (
                          <div>
                            <p className="text-green-200">Batch</p>
                            <p className="font-semibold">{studentData.batchYear}</p>
                          </div>
                        )}
                        {studentData?.section && (
                          <div>
                            <p className="text-green-200">Section</p>
                            <p className="font-semibold">{studentData.section}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="p-2">
                      <button
                        onClick={handleViewProfile}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">View Full Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/student/dashboard');
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="font-medium">Dashboard</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Notifications & Logout */}
            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <StudentNotificationDropdown
                    onClose={() => setShowNotifications(false)}
                    onNotificationUpdate={fetchUnreadCount}
                  />
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="group relative bg-white text-red-600 px-6 py-2.5 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl flex items-center space-x-2 font-semibold"
              >
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default EnhancedStudentNavbar;


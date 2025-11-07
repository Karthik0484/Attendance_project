import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import NotificationCenter from './NotificationCenter';
import ProfileModal from './ProfileModal';
import { API_BASE_URL } from '../config/apiConfig';

const EnhancedFacultyNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);

  // Fetch faculty summary
  const fetchFacultySummary = async () => {
    try {
      console.log('🔍 Fetching faculty summary...');
      const response = await apiFetch({
        url: '/api/faculty/me/summary',
        method: 'GET'
      });

      console.log('📊 Faculty summary response:', response.data);

      if (response.data.success) {
        console.log('✅ Profile data:', response.data.data.profile);
        console.log('✅ Summary data:', response.data.data.summary);
        setProfileData(response.data.data.profile);
        setSummary(response.data.data.summary);
      } else {
        console.error('❌ API returned success: false');
      }
    } catch (error) {
      console.error('❌ Error fetching faculty summary:', error);
      console.error('Error details:', error.response?.data);
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
    fetchFacultySummary();
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

  const handleProfileUpdate = () => {
    // Refresh the faculty data without closing the modal
    fetchFacultySummary();
  };

  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 py-2">
            <div className="animate-pulse flex items-center space-x-2 sm:space-x-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white rounded-full"></div>
              <div className="space-y-2 hidden sm:block">
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 py-2">
            {/* Left Side - Profile Trigger */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 hover:bg-white hover:bg-opacity-10 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-all group w-full sm:w-auto"
                >
                  {/* Enhanced Avatar */}
                  <div className="relative flex-shrink-0">
                    {profileData?.profilePhoto ? (
                      <img
                        src={`${API_BASE_URL}${profileData.profilePhoto}`}
                        alt="Profile"
                        className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover ring-2 sm:ring-4 ring-blue-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center ring-2 sm:ring-4 ring-blue-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all">
                        <span className="text-blue-600 font-bold text-lg sm:text-xl md:text-2xl">
                          {profileData?.name?.charAt(0) || user?.name?.charAt(0) || 'F'}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border border-white animate-pulse"></div>
                  </div>
                  
                  {/* User Info - Hidden on very small screens, shown on sm+ */}
                  <div className="text-left hidden sm:block min-w-0 flex-1">
                    <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                      <h4 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white group-hover:text-blue-100 transition-colors truncate">
                        {profileData?.name || user?.name || 'Faculty'}
                      </h4>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200 group-hover:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 sm:mt-1 min-w-0">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-xs sm:text-sm font-medium text-blue-100 truncate">
                        {profileData?.department || user?.department}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-lg shadow-2xl overflow-hidden animate-fadeIn z-50">
                    {/* Profile Snapshot */}
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 sm:p-6 text-white">
                      <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                        {profileData?.profilePhoto ? (
                          <img
                            src={`${API_BASE_URL}${profileData.profilePhoto}`}
                            alt="Profile"
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover ring-2 ring-white shadow-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold text-2xl sm:text-3xl">
                              {profileData?.name?.charAt(0) || 'F'}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold truncate">{profileData?.name}</h3>
                          <p className="text-blue-100 text-xs sm:text-sm">{profileData?.role}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <p className="text-blue-200">Faculty ID</p>
                          <p className="font-semibold truncate">{profileData?.facultyId}</p>
                        </div>
                        <div>
                          <p className="text-blue-200">Department</p>
                          <p className="font-semibold truncate">{profileData?.department}</p>
                        </div>
                      </div>
                    </div>

                    {/* Institution Summary */}
                    {summary && (
                      <div className="p-3 sm:p-4 bg-gray-50 border-b">
                        <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">Quick Stats</h4>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-xl sm:text-2xl font-bold text-blue-600">{summary.totalClasses}</p>
                            <p className="text-xs text-gray-600">Classes</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-xl sm:text-2xl font-bold text-green-600">{summary.totalStudents}</p>
                            <p className="text-xs text-gray-600">Students</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-xl sm:text-2xl font-bold text-purple-600">{summary.activeSemesters?.length || 0}</p>
                            <p className="text-xs text-gray-600">Semesters</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="p-2 sm:p-3">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">View Full Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/class-management');
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 sm:py-3 text-gray-700 hover:bg-blue-50 rounded-lg transition-colors text-sm sm:text-base"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="font-medium">My Classes</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Notifications & Logout */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              {/* Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5 sm:p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center animate-pulse text-[10px] sm:text-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Panel */}
                {showNotifications && (
                  <NotificationCenter 
                    onClose={() => setShowNotifications(false)}
                    onNotificationUpdate={fetchUnreadCount}
                  />
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="group relative bg-white text-red-600 px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl flex items-center space-x-1 sm:space-x-2 font-semibold text-xs sm:text-sm md:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden xs:inline sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profileData={profileData}
          summary={summary}
          onClose={() => setShowProfileModal(false)}
          onUpdate={handleProfileUpdate}
        />
      )}
    </>
  );
};

export default EnhancedFacultyNavbar;


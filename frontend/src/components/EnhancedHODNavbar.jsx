import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import ProfileModal from './ProfileModal';
import { API_BASE_URL } from '../config/apiConfig';

const EnhancedHODNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const dropdownRef = useRef(null);

  // Fetch HOD summary
  const fetchHODSummary = async () => {
    try {
      console.log('🔍 Fetching HOD summary...');
      
      // Try to get HOD data from User model and dashboard stats
      const [userResponse, statsResponse] = await Promise.all([
        apiFetch({
          url: '/api/auth/me',
          method: 'GET'
        }),
        apiFetch({
          url: '/api/faculty/hod/dashboard-stats',
          method: 'GET'
        })
      ]);

      if (userResponse.data.success && statsResponse.data.success) {
        const userData = userResponse.data.user;
        const stats = statsResponse.data.data;
        
        // Build profile data from User model
        const profile = {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          department: userData.department,
          role: 'Head of Department',
          phone: userData.mobile || userData.phone || 'Not provided',
          address: userData.address || 'Not provided',
          profilePhoto: userData.profileImage || null,
          facultyId: userData.id.toString().slice(-6) // Use user ID as identifier
        };
        
        // Build summary from dashboard stats
        const hodSummary = {
          totalClasses: 0, // HOD doesn't have classes directly
          totalStudents: stats.totalStudents || 0,
          totalFaculty: stats.totalFaculty || 0,
          activeSemesters: [] // Can be populated if needed
        };
        
        console.log('✅ Profile data:', profile);
        console.log('✅ Summary data:', hodSummary);
        
        setProfileData(profile);
        setSummary(hodSummary);
      } else {
        console.error('❌ API returned success: false');
      }
    } catch (error) {
      console.error('❌ Error fetching HOD summary:', error);
      // Fallback to user data from context
      if (user) {
        setProfileData({
          id: user._id || user.id,
          name: user.name,
          email: user.email,
          department: user.department,
          role: 'Head of Department',
          phone: user.mobile || user.phone || 'Not provided',
          address: user.address || 'Not provided',
          profilePhoto: user.profileImage || null,
          facultyId: (user._id || user.id || '').toString().slice(-6)
        });
        setSummary({
          totalClasses: 0,
          totalStudents: 0,
          totalFaculty: 0,
          activeSemesters: []
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHODSummary();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
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
    // Refresh the HOD data without closing the modal
    fetchHODSummary();
  };

  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-700 to-indigo-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 py-2">
            <div className="animate-pulse flex items-center space-x-3 sm:space-x-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full"></div>
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 shadow-2xl border-b border-white border-opacity-20">
        {/* Animated background overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20 py-2">
            {/* Left Side - Profile Trigger with enhanced design */}
            <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-3 sm:space-x-3 md:space-x-4 hover:bg-white hover:bg-opacity-20 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 transition-all duration-300 group w-full sm:w-auto backdrop-blur-sm border border-white border-opacity-10 hover:border-opacity-30 hover:shadow-lg"
                >
                  {/* Enhanced Avatar with glow effect */}
                  <div className="relative flex-shrink-0">
                    <div className="hidden sm:block absolute inset-0 bg-white rounded-full opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-300"></div>
                    {profileData?.profilePhoto ? (
                      <img
                        src={`${API_BASE_URL}${profileData.profilePhoto}`}
                        alt="Profile"
                        className="relative w-12 h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full object-cover ring-2 sm:ring-4 ring-white ring-opacity-60 shadow-xl group-hover:ring-opacity-90 group-hover:scale-110 transition-all duration-300"
                      />
                    ) : (
                      <div className="relative w-12 h-12 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center ring-2 sm:ring-4 ring-white ring-opacity-60 shadow-xl group-hover:ring-opacity-90 group-hover:scale-110 transition-all duration-300">
                        <span className="text-indigo-600 font-bold text-xl sm:text-xl md:text-2xl">
                          {profileData?.name?.charAt(0) || user?.name?.charAt(0) || 'H'}
                        </span>
                      </div>
                    )}
                    {/* Enhanced online status indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full border-2 border-white shadow-lg"></div>
                  </div>
                  
                  {/* User Info - Always visible on mobile, enhanced on desktop */}
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                      <h4 className="text-base sm:text-base md:text-lg lg:text-xl font-bold text-white group-hover:text-yellow-200 transition-colors truncate drop-shadow-md">
                        {profileData?.name || user?.name || 'HOD'}
                      </h4>
                      {/* Verified badge - hidden on mobile */}
                      <svg className="hidden sm:block w-3 h-3 sm:w-4 sm:h-4 text-yellow-300 flex-shrink-0 drop-shadow-md" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <svg className="hidden sm:block w-3 h-3 sm:w-4 sm:h-4 text-white group-hover:rotate-180 transition-transform duration-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 sm:mt-1 min-w-0">
                      <p className="text-sm sm:text-sm font-medium text-white truncate drop-shadow-sm">
                        {profileData?.department || user?.department}
                        {summary?.totalFaculty ? ` • ${summary.totalFaculty}` : ''}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-fadeIn z-50 border border-gray-100">
                    {/* Profile Snapshot - Enhanced with better gradient and design */}
                    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4 sm:p-6 text-white overflow-hidden">
                      {/* Decorative background pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
                      </div>
                      
                      <div className="relative flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
                        <div className="relative group">
                          {profileData?.profilePhoto ? (
                            <img
                              src={`${API_BASE_URL}${profileData.profilePhoto}`}
                              alt="Profile"
                              className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-white ring-opacity-50 shadow-xl flex-shrink-0 transform group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white ring-opacity-50 shadow-xl transform group-hover:scale-105 transition-transform duration-300">
                              <span className="text-indigo-600 font-bold text-2xl sm:text-3xl">
                                {profileData?.name?.charAt(0) || 'H'}
                              </span>
                            </div>
                          )}
                          {/* Online status indicator */}
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-green-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-base sm:text-lg md:text-xl font-bold truncate drop-shadow-sm">{profileData?.name}</h3>
                            {/* Verified badge */}
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <p className="text-indigo-100 text-xs sm:text-sm font-medium">Head of Department</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Info Cards */}
                      <div className="relative grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white border-opacity-30">
                          <p className="text-indigo-200 text-xs mb-1 flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                            </svg>
                            <span>HOD ID</span>
                          </p>
                          <p className="font-bold text-sm sm:text-base truncate">{profileData?.facultyId || 'N/A'}</p>
                        </div>
                        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white border-opacity-30">
                          <p className="text-indigo-200 text-xs mb-1 flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span>Department</span>
                          </p>
                          <p className="font-bold text-sm sm:text-base truncate">{profileData?.department}</p>
                        </div>
                      </div>
                    </div>

                    {/* Department Summary - Enhanced with icons and better styling */}
                    {summary && (
                      <div className="p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-indigo-50 border-b border-gray-200">
                        <div className="flex items-center space-x-2 mb-3">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h4 className="text-xs sm:text-sm font-bold text-gray-800">Department Overview</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-indigo-100 hover:border-indigo-300">
                            <div className="flex justify-center mb-1">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-indigo-600 mb-0.5">{summary.totalFaculty}</p>
                            <p className="text-xs text-gray-600 font-medium">Faculty</p>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-green-100 hover:border-green-300">
                            <div className="flex justify-center mb-1">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-green-600 mb-0.5">{summary.totalStudents}</p>
                            <p className="text-xs text-gray-600 font-medium">Students</p>
                          </div>
                          <div className="text-center p-2 sm:p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 border border-purple-100 hover:border-purple-300">
                            <div className="flex justify-center mb-1">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xl sm:text-2xl font-bold text-purple-600 mb-0.5">{summary.totalClasses || 0}</p>
                            <p className="text-xs text-gray-600 font-medium">Classes</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions - Enhanced CTA Button */}
                    <div className="p-3 sm:p-4 bg-white">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full group relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                      >
                        {/* Animated background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <div className="relative flex items-center justify-center space-x-2 sm:space-x-3">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-bold">View Full Profile</span>
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Enhanced Logout Button */}
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              {/* Logout Button with enhanced design */}
              <button
                onClick={handleLogout}
                className="group relative bg-white text-red-600 px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl flex items-center space-x-1.5 sm:space-x-2 font-semibold text-sm sm:text-sm md:text-base"
              >
                <svg className="w-5 h-5 sm:w-5 sm:h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="sm:inline">Logout</span>
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

export default EnhancedHODNavbar;


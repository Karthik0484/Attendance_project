import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import ProfileModal from './ProfileModal';

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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 via-purple-700 to-indigo-700 shadow-lg">
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
                    {profileData?.profilePhoto ? (
                      <img
                        src={`http://localhost:5000${profileData.profilePhoto}`}
                        alt="Profile"
                        className="w-14 h-14 rounded-full object-cover ring-4 ring-indigo-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center ring-4 ring-indigo-300 ring-opacity-50 shadow-lg group-hover:ring-opacity-70 transition-all">
                        <span className="text-indigo-600 font-bold text-2xl">
                          {profileData?.name?.charAt(0) || user?.name?.charAt(0) || 'H'}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border border-white animate-pulse"></div>
                  </div>
                  
                  {/* User Info */}
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xl font-bold text-white group-hover:text-indigo-100 transition-colors">
                        {profileData?.name || user?.name || 'HOD'}
                      </h4>
                      <svg className="w-4 h-4 text-indigo-200 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <svg className="w-4 h-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-sm font-medium text-indigo-100">
                        {profileData?.department || user?.department} Department
                      </p>
                    </div>
                  </div>
                </button>

                {/* Profile Dropdown */}
                {showProfileDropdown && (
                  <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-2xl overflow-hidden animate-fadeIn">
                    {/* Profile Snapshot */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                      <div className="flex items-center space-x-4 mb-4">
                        {profileData?.profilePhoto ? (
                          <img
                            src={`http://localhost:5000${profileData.profilePhoto}`}
                            alt="Profile"
                            className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-bold text-3xl">
                              {profileData?.name?.charAt(0) || 'H'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-bold">{profileData?.name}</h3>
                          <p className="text-indigo-100 text-sm">Head of Department</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-indigo-200">HOD ID</p>
                          <p className="font-semibold">{profileData?.facultyId || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-indigo-200">Department</p>
                          <p className="font-semibold">{profileData?.department}</p>
                        </div>
                      </div>
                    </div>

                    {/* Department Summary */}
                    {summary && (
                      <div className="p-4 bg-gray-50 border-b">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Department Overview</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-2xl font-bold text-indigo-600">{summary.totalFaculty}</p>
                            <p className="text-xs text-gray-600">Faculty</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-2xl font-bold text-green-600">{summary.totalStudents}</p>
                            <p className="text-xs text-gray-600">Students</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                            <p className="text-2xl font-bold text-purple-600">{summary.totalClasses || 0}</p>
                            <p className="text-xs text-gray-600">Classes</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">View Full Profile</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Logout */}
            <div className="flex items-center space-x-4">
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="group relative bg-white text-rose-600 px-6 py-2.5 rounded-lg hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-md hover:shadow-xl flex items-center space-x-2 font-semibold"
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


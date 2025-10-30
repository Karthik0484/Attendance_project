import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import SemesterCard from '../../components/SemesterCard';
import HolidayNotificationCard from '../../components/HolidayNotificationCard';
import Footer from '../../components/Footer';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSemesters = async (silent = false) => {
    try {
      if (!user?.id) {
        console.warn('⚠️ No user ID found, cannot fetch semesters');
        return;
      }
      
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      
      console.log('📚 Fetching semesters for user:', {
        userId: user.id,
        userName: user.name,
        userDepartment: user.department,
        userRole: user.role
      });
      
      const res = await fetch(`/api/students/${user.id}/semesters`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      console.log('📊 Full API Response:', {
        status: res.status,
        ok: res.ok,
        success: data.success,
        message: data.message,
        semestersCount: data.data?.semesters?.length || 0,
        data: data
      });
      
      if (res.ok && data.success) {
        setSemesters(data.data.semesters || []);
        console.log('✅ Semesters loaded successfully:', data.data.semesters?.length || 0);
        if (data.data.semesters && data.data.semesters.length > 0) {
          console.log('📋 Semester details:', data.data.semesters.map(s => ({
            id: s._id,
            name: s.semesterName,
            year: s.year,
            section: s.section,
            classId: s.classId,
            status: s.status
          })));
        }
      } else {
        console.error('❌ Failed to fetch semesters:', {
          status: res.status,
          message: data.message,
          debug: data.debug
        });
      }
    } catch (e) {
      console.error('❌ Error fetching semesters:', e);
      console.error('Error details:', {
        message: e.message,
        stack: e.stack
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
    
    // Poll every 30 seconds for updates
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for semester updates...');
      fetchSemesters(true);
    }, 30000);
    
    return () => clearInterval(pollInterval);
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your semesters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎒</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.name}</p>
                <p className="text-sm text-blue-600">Department: {user?.department}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {isRefreshing && (
                <div className="flex items-center space-x-2 text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Updating...</span>
                </div>
              )}
              <button
                onClick={() => fetchSemesters(false)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                title="Refresh semesters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Holiday Notification Card - Full Width */}
        <div className="mb-8">
          <HolidayNotificationCard />
        </div>

        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Semesters</h2>
          <p className="text-gray-600">
            Select a semester to view detailed attendance and academic information
          </p>
        </div>

        {/* Semesters Grid */}
        {semesters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Semesters Found</h3>
            <p className="text-gray-600 mb-4">
              You are not currently enrolled in any semesters. Please contact your faculty advisor.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {semesters.map((semester) => (
              <SemesterCard key={semester._id} semester={semester} />
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {semesters.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">📚</span>
                <div>
                  <p className="text-sm text-gray-600">Total Semesters</p>
                  <p className="text-2xl font-bold text-gray-900">{semesters.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">🎯</span>
                <div>
                  <p className="text-sm text-gray-600">Active Semesters</p>
                  <p className="text-2xl font-bold text-green-600">
                    {semesters.filter(s => s.status === 'active').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">✅</span>
                <div>
                  <p className="text-sm text-gray-600">Completed Semesters</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {semesters.filter(s => s.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default StudentDashboard;

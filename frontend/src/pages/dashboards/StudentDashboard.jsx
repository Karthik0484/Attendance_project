import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import SemesterCard from '../../components/SemesterCard';
import HolidayNotificationCard from '../../components/HolidayNotificationCard';
import EnhancedStudentNavbar from '../../components/EnhancedStudentNavbar';
import Footer from '../../components/Footer';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSemesters = async (silent = false) => {
    try {
      if (!user?.id) {
        console.warn('⚠️ No user ID found, cannot fetch semesters');
        return;
      }
      
      if (!silent) setLoading(true);
      
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
    }
  };

  useEffect(() => {
    fetchSemesters();
    
    // Poll every 30 seconds for updates
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for updates...');
      fetchSemesters(true);
    }, 30000);
    
    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* Enhanced Navbar */}
      <EnhancedStudentNavbar />

      {/* Main Content */}
      <main className="pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="mt-2 text-gray-600">
              View your semesters, attendance, and academic information
            </p>
          </div>

          {/* Page Title for Semesters */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">My Semesters</h2>
            <p className="text-gray-600">
              Select a semester to view detailed attendance and academic information
            </p>
          </div>

          {/* Semesters Grid - Shown First */}
          {semesters.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center mb-8">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Semesters Found</h3>
              <p className="text-gray-600 mb-4">
                You are not currently enrolled in any semesters. Please contact your faculty advisor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {semesters.map((semester) => (
                <SemesterCard key={semester._id} semester={semester} />
              ))}
            </div>
          )}

          {/* Holiday Notification Card - Below Semesters */}
          <div className="mb-8">
            <HolidayNotificationCard />
          </div>

          {/* Quick Stats */}
          {semesters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default StudentDashboard;

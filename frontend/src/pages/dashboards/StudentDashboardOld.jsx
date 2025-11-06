import { useAuth } from '../../context/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import ReasonSubmissionModal from '../../components/ReasonSubmissionModal';
import HolidayNotificationCard from '../../components/HolidayNotificationCard';
import AbsenceReasonModal from '../../components/AbsenceReasonModal';
import { getApiUrl } from '../../utils/apiFetch';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [todayStatus, setTodayStatus] = useState('-');
  const [overall, setOverall] = useState('-');
  const [history, setHistory] = useState([]);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showAbsenceReasonModal, setShowAbsenceReasonModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [classId, setClassId] = useState(null);

  const handleReasonSubmit = (record) => {
    setSelectedRecord({
      studentId: user.id,
      date: record.date,
      status: record.status
    });
    setShowReasonModal(true);
  };

  const handleReasonSuccess = (updatedData) => {
    // Update the history with the new reason
    setHistory(prev => prev.map(record => 
      record.date === updatedData.date 
        ? { ...record, reason: updatedData.reason }
        : record
    ));
    setShowReasonModal(false);
    setSelectedRecord(null);
  };

  const handleAbsenceReasonSubmit = (record) => {
    setSelectedRecord(record);
    setShowAbsenceReasonModal(true);
  };

  const handleAbsenceReasonSuccess = (updatedData) => {
    // Update the history with the new reason and review status
    setHistory(prev => prev.map(record => 
      record.date === updatedData.date 
        ? { ...record, reason: updatedData.reason, reviewStatus: 'Pending' }
        : record
    ));
    setShowAbsenceReasonModal(false);
    setSelectedRecord(null);
    
    // Show success message
    console.log('✅ Absence reason submitted successfully');
  };

  // Filter history by semester
  const filteredHistory = selectedSemester === 'all' 
    ? history 
    : history.filter(record => {
        // If we had semester data per record, we'd filter here
        // For now, showing all records
        return true;
      });

  const fetchAttendance = useCallback(async (silent = false) => {
    try {
      if (!user?.id) return;
      if (!silent) setIsRefreshing(true);
      
      console.log('📡 Fetching attendance data for user:', user.id);
      
      // Fetch student profile to get classId
      const profileRes = await fetch(getApiUrl(`/api/students/${user.id}/profile`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data?.classId) {
          setClassId(profileData.data.classId);
        }
      }
      
      // Fetch attendance data
      const res = await fetch(getApiUrl(`/api/attendance/student/${user.id}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      console.log('📊 Attendance data received:', data);
      
      if (res.ok && data && Array.isArray(data.attendance)) {
        setHistory(data.attendance);
        setOverall(data.overall_percentage || '-');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayRec = data.attendance.find(a => a.date === today);
        setTodayStatus(todayRec ? todayRec.status : '-');
        
        if (!silent) {
          // Scroll to top when data loads
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        console.log('✅ Attendance data updated successfully');
      }
    } catch (e) {
      console.error('❌ Error fetching attendance:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAttendance();
    
    // Also poll every 10 seconds as backup to SSE
    const pollInterval = setInterval(() => {
      console.log('📡 Polling for attendance updates (backup)...');
      fetchAttendance(true);
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, [fetchAttendance]);

  // Real-time updates via SSE
  useEffect(() => {
    if (!user?.id || !localStorage.getItem('accessToken')) return;
    const token = localStorage.getItem('accessToken');
    const url = `/api/attendance/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const onAttendance = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (!payload?.date || !payload?.status) return;
        
        // Update attendance history
        setHistory(prev => {
          const idx = prev.findIndex(r => r.date === payload.date);
          let updatedHistory;
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], status: payload.status, reason: payload.reason || next[idx].reason };
            updatedHistory = next;
          } else {
            updatedHistory = [{ date: payload.date, status: payload.status, reason: payload.reason }, ...prev];
          }
          
          // Recalculate overall percentage (OD is considered as present)
          const totalRecords = updatedHistory.filter(r => r.status !== 'Not Marked');
          const presentRecords = updatedHistory.filter(r => r.status === 'Present' || r.status === 'OD');
          if (totalRecords.length > 0) {
            const percentage = Math.round((presentRecords.length / totalRecords.length) * 100);
            setOverall(`${percentage}%`);
          }
          
          return updatedHistory;
        });
        
        // Update today's status
        const today = new Date().toISOString().slice(0,10);
        if (payload.date === today) {
          setTodayStatus(payload.status);
        }
        
        console.log('📡 Real-time attendance update received:', payload);
      } catch (_) {}
    };

    es.addEventListener('attendance', onAttendance);

    es.onerror = () => {
      try { es.close(); } catch (_) {}
    };

    return () => {
      try { es.removeEventListener('attendance', onAttendance); } catch (_) {}
      try { es.close(); } catch (_) {}
    };
  }, [user?.id]);

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
                onClick={() => fetchAttendance(false)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1"
                title="Refresh attendance"
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
        {/* Attendance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📊</span>
              <div>
                <p className="text-sm text-gray-600">Overall Attendance</p>
                <p className="text-2xl font-bold text-green-600">{overall}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">✅</span>
              <div>
                <p className="text-sm text-gray-600">Present Days</p>
                <p className="text-2xl font-bold text-gray-900">142</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">❌</span>
              <div>
                <p className="text-sm text-gray-600">Absent Days</p>
                <p className="text-2xl font-bold text-red-600">9</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-3">📚</span>
              <div>
                <p className="text-sm text-gray-600">Active Subjects</p>
                <p className="text-2xl font-bold text-gray-900">6</p>
              </div>
            </div>
          </div>
        </div>

        {/* Holiday Notification Card - Full Width */}
        <div className="mb-8">
          <HolidayNotificationCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📅</span>
              <h3 className="text-lg font-semibold">Today's Status</h3>
            </div>
            <div className={`p-4 rounded-lg ${
              todayStatus === 'Present' ? 'bg-green-50 border-l-4 border-green-500' : 
              todayStatus === 'Absent' ? 'bg-red-50 border-l-4 border-red-500' : 
              todayStatus === 'Not Marked' ? 'bg-yellow-50 border-l-4 border-yellow-500' : 
              'bg-gray-50 border'
            }`}>
              <p className="font-medium">
                {todayStatus === '-' ? 'No record for today' : 
                 todayStatus === 'Not Marked' ? '❔ Not Marked' : 
                 todayStatus}
              </p>
              {todayStatus === 'Not Marked' && (
                <p className="text-sm text-yellow-700 mt-1">Attendance not yet recorded by faculty</p>
              )}
            </div>
          </div>

          {/* Subject-wise Attendance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📚</span>
              <h3 className="text-lg font-semibold">Subject-wise Attendance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Data Structures</span>
                  <span className="text-sm text-gray-600">96.7%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '96.7%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Algorithms</span>
                  <span className="text-sm text-gray-600">92.3%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '92.3%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Database Systems</span>
                  <span className="text-sm text-gray-600">94.1%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '94.1%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Computer Networks</span>
                  <span className="text-sm text-gray-600">89.5%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '89.5%'}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <span className="text-3xl mr-3">🕒</span>
                <h3 className="text-lg font-semibold">Attendance History</h3>
              </div>
              {/* Semester Filter - Simple version */}
              <select 
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Semesters</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
                <option value="3">Semester 3</option>
                <option value="4">Semester 4</option>
                <option value="5">Semester 5</option>
                <option value="6">Semester 6</option>
                <option value="7">Semester 7</option>
                <option value="8">Semester 8</option>
              </select>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {filteredHistory.length === 0 && (
                <div className="p-3 bg-gray-50 rounded-lg text-gray-600 text-sm">No attendance records found.</div>
              )}
              {filteredHistory.map((rec, idx) => (
                <div key={`${rec.date}-${idx}`} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{rec.date}</p>
                      {rec.reason && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Your Reason:</span> {rec.reason}
                          </p>
                          {rec.reviewStatus === 'Pending' && (
                            <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              ⏳ Pending Review
                            </span>
                          )}
                          {rec.reviewStatus === 'Reviewed' && (
                            <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              ✅ Reviewed
                            </span>
                          )}
                        </div>
                      )}
                      {rec.facultyNote && (
                        <div className="mt-2 p-2 bg-purple-50 rounded border-l-4 border-purple-500">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Faculty Note:</span> {rec.facultyNote}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`${
                        rec.status === 'Present' ? 'text-green-600' : 
                        rec.status === 'Absent' ? 'text-red-600' : 
                        rec.status === 'Holiday' ? 'text-purple-600' :
                        rec.status === 'Not Marked' ? 'text-yellow-600' : 
                        'text-gray-600'
                      } font-semibold text-sm whitespace-nowrap`}>
                        {rec.status === 'Not Marked' ? '❔ Not Marked' : 
                         rec.status === 'Holiday' ? '🎉 Holiday' : rec.status}
                      </span>
                      {rec.status === 'Absent' && !rec.reason && (
                        <button
                          onClick={() => handleAbsenceReasonSubmit(rec)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          📝 Add Reason
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attendance Reports */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <span className="text-3xl mr-3">📊</span>
              <h3 className="text-lg font-semibold">Attendance Reports</h3>
            </div>
            <p className="text-gray-600 mb-4">View detailed attendance reports and analytics</p>
            <div className="space-y-2">
              <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-left">
                📈 Weekly Report
              </button>
              <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-left">
                📅 Monthly Report
              </button>
              <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-left">
                📊 Subject-wise Report
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Reason Submission Modal */}
      <ReasonSubmissionModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        attendanceRecord={selectedRecord}
        onSuccess={handleReasonSuccess}
      />

      {/* Absence Reason Modal */}
      <AbsenceReasonModal
        isOpen={showAbsenceReasonModal}
        onClose={() => setShowAbsenceReasonModal(false)}
        attendance={selectedRecord}
        studentId={user?.id}
        classId={classId}
        onSuccess={handleAbsenceReasonSuccess}
      />
    </div>
  );
};

export default StudentDashboard;

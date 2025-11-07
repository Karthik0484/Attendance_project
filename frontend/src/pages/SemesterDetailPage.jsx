import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AbsenceReasonModal from '../components/AbsenceReasonModal';
import { getApiUrl } from '../utils/apiFetch';

const SemesterDetailPage = () => {
  const { semesterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [semesterData, setSemesterData] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAbsenceReasonModal, setShowAbsenceReasonModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, present, absent, od, holiday

  // Get semester data from navigation state or fetch it
  const semesterInfo = location.state?.semester;

  const fetchSemesterAttendance = useCallback(async (silent = false) => {
    try {
      if (!user?.id || !semesterId) return;
      
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      console.log('📊 Fetching semester attendance:', { userId: user.id, semesterId });

      const res = await fetch(getApiUrl(`/api/students/${user.id}/semesters/${semesterId}/attendance`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });

      const data = await res.json();
      console.log('📊 Response data:', data);

      if (res.ok && data.success) {
        setSemesterData(data.data.semester);
        setAttendance(data.data.attendance);
        setStats(data.data.stats);
        console.log('✅ Semester attendance loaded successfully');
      } else {
        console.error('❌ Failed to fetch semester attendance:', data.message);
      }
    } catch (error) {
      console.error('❌ Error fetching semester attendance:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, semesterId]);

  useEffect(() => {
    fetchSemesterAttendance();

    // Poll every 15 seconds for updates
    const interval = setInterval(() => {
      console.log('🔄 Polling for semester attendance updates...');
      fetchSemesterAttendance(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchSemesterAttendance]);

  const handleAbsenceReasonSubmit = (record) => {
    setSelectedRecord(record);
    setShowAbsenceReasonModal(true);
  };

  const handleAbsenceReasonSuccess = (updatedData) => {
    setAttendance(prev => prev.map(record => 
      record.date === updatedData.date 
        ? { ...record, reason: updatedData.reason, reviewStatus: 'Pending' }
        : record
    ));
    setShowAbsenceReasonModal(false);
    setSelectedRecord(null);
  };

  const handleBack = () => {
    navigate('/student');
  };

  const handleRefresh = () => {
    fetchSemesterAttendance();
  };

  // Filter attendance based on selected filter
  const filteredAttendance = filterStatus === 'all' 
    ? attendance 
    : attendance.filter(record => {
        if (filterStatus === 'present') {
          const status = record.status?.toLowerCase() || '';
          return status === 'present' || status === 'od';
        }
        if (filterStatus === 'absent') return record.status === 'Absent';
        if (filterStatus === 'od') {
          const status = record.status?.toLowerCase() || '';
          return status === 'od' || status === 'onduty';
        }
        if (filterStatus === 'holiday') return record.status === 'Holiday';
        return true;
      });

  // Get percentage color
  const getPercentageColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600 bg-green-50';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading semester details...</p>
        </div>
      </div>
    );
  }

  if (!semesterData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Semester not found</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                aria-label="Go back"
              >
                <span className="text-xl sm:text-2xl">←</span>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
                  {semesterData.semesterName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {semesterData.year} - Section {semesterData.section} - Class {semesterData.classAssigned}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-sm sm:text-base"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Attendance Percentage */}
          <div className={`rounded-lg shadow-md p-4 sm:p-6 ${getPercentageColor(stats?.attendancePercentage || 0)}`}>
            <div className="flex items-center mb-2">
              <span className="text-2xl sm:text-3xl mr-2 sm:mr-3">📊</span>
              <h3 className="text-xs sm:text-sm font-medium">Attendance</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold">{stats?.attendancePercentage || 0}%</p>
          </div>

          {/* Total Classes */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center mb-2">
              <span className="text-2xl sm:text-3xl mr-2 sm:mr-3">📅</span>
              <h3 className="text-xs sm:text-sm font-medium text-gray-700">Working Days</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-blue-600">{stats?.totalWorkingDays || 0}</p>
          </div>

          {/* Present Days (incl. OD) */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center mb-2">
              <span className="text-2xl sm:text-3xl mr-2 sm:mr-3">✅</span>
              <h3 className="text-xs sm:text-sm font-medium text-gray-700">Present Days</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-green-600">
              {(stats?.presentDays || 0) + (stats?.odDays || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">(incl. {stats?.odDays || 0} OD)</p>
          </div>

          {/* OD Days */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center mb-2">
              <span className="text-2xl sm:text-3xl mr-2 sm:mr-3">🔄</span>
              <h3 className="text-xs sm:text-sm font-medium text-gray-700">OD Days</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-blue-600">{stats?.odDays || 0}</p>
          </div>

          {/* Absent Days */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center mb-2">
              <span className="text-2xl sm:text-3xl mr-2 sm:mr-3">❌</span>
              <h3 className="text-xs sm:text-sm font-medium text-gray-700">Absent Days</h3>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-red-600">{stats?.absentDays || 0}</p>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex flex-col gap-4 sm:gap-5">
              {/* Header */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <span className="text-2xl sm:text-3xl flex-shrink-0">📋</span>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Attendance Records</h2>
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    filterStatus === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({attendance.length})
                </button>
                <button
                  onClick={() => setFilterStatus('present')}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    filterStatus === 'present'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Present ({(stats?.presentDays || 0) + (stats?.odDays || 0)})
                </button>
                <button
                  onClick={() => setFilterStatus('od')}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    filterStatus === 'od'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  OD ({stats?.odDays || 0})
                </button>
                <button
                  onClick={() => setFilterStatus('absent')}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    filterStatus === 'absent'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Absent ({stats?.absentDays || 0})
                </button>
                <button
                  onClick={() => setFilterStatus('holiday')}
                  className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    filterStatus === 'holiday'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Holidays ({stats?.holidayDays || 0})
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {filteredAttendance.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-500">
                <p className="text-sm sm:text-base">No records found for the selected filter</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4 max-h-[600px] overflow-y-auto">
                {filteredAttendance.map((record, idx) => (
                  <div
                    key={`${record.date}-${idx}`}
                    className="p-4 sm:p-5 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      {/* Left Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Date */}
                        <p className="font-semibold text-sm sm:text-base text-gray-900 leading-tight">
                          {new Date(record.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </p>
                        
                        {/* Holiday Reason */}
                        {record.holidayReason && (
                          <div className="mt-2.5 p-2.5 sm:p-3 bg-purple-50 rounded-md border-l-4 border-purple-500">
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                              <span className="font-medium text-purple-700">Holiday:</span> {record.holidayReason}
                            </p>
                          </div>
                        )}

                        {/* Student Reason */}
                        {record.reason && (
                          <div className="mt-2.5 p-2.5 sm:p-3 bg-blue-50 rounded-md border-l-4 border-blue-500">
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed break-words">
                              <span className="font-medium text-blue-700">Your Reason:</span> {record.reason}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              {record.reviewStatus === 'Pending' && (
                                <span className="inline-flex items-center text-xs bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-md font-medium">
                                  ⏳ Pending Review
                                </span>
                              )}
                              {record.reviewStatus === 'Reviewed' && (
                                <span className="inline-flex items-center text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-md font-medium">
                                  ✅ Reviewed
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Faculty Note */}
                        {record.facultyNote && (
                          <div className="mt-2.5 p-2.5 sm:p-3 bg-purple-50 rounded-md border-l-4 border-purple-500">
                            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed break-words">
                              <span className="font-medium text-purple-700">Faculty Note:</span> {record.facultyNote}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Content - Status Badge and Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 sm:gap-3 sm:ml-4 flex-shrink-0">
                        <span
                          className={`inline-flex items-center justify-center px-3.5 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap ${
                            record.status === 'Present'
                              ? 'bg-green-100 text-green-700'
                              : record.status === 'Absent'
                              ? 'bg-red-100 text-red-700'
                              : record.status === 'OD' || record.status === 'od'
                              ? 'bg-blue-100 text-blue-700'
                              : record.status === 'Holiday'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {record.status === 'Present' && '✅ Present'}
                          {record.status === 'Absent' && '❌ Absent'}
                          {(record.status === 'OD' || record.status === 'od') && '🔄 OD'}
                          {record.status === 'Holiday' && '🎉 Holiday'}
                        </span>

                        {record.status === 'Absent' && !record.reason && (
                          <button
                            onClick={() => handleAbsenceReasonSubmit(record)}
                            className="w-full sm:w-auto px-3.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-xs sm:text-sm whitespace-nowrap font-medium shadow-sm hover:shadow"
                          >
                            📝 Add Reason
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Absence Reason Modal */}
      <AbsenceReasonModal
        isOpen={showAbsenceReasonModal}
        onClose={() => setShowAbsenceReasonModal(false)}
        attendance={selectedRecord}
        studentId={user?.id}
        classId={semesterData?.classId}
        onSuccess={handleAbsenceReasonSuccess}
      />
    </div>
  );
};

export default SemesterDetailPage;



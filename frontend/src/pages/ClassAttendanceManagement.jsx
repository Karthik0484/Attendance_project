import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import BulkUploadModal from '../components/BulkUploadModal';
import HolidayDeclarationModal from '../components/HolidayDeclarationModal';
import HolidayList from '../components/HolidayList';
import AbsenceReasonReviewCard from '../components/AbsenceReasonReviewCard';
import AbsenteeReportTab from '../components/AbsenteeReportTab';

const ClassAttendanceManagement = () => {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mark');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [holidayRefreshKey, setHolidayRefreshKey] = useState(0);

  useEffect(() => {
    if (classId) {
      fetchClassData();
    }
  }, [classId]);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching class data for classId:', classId);
      
      // Fetch class assignment details using the ClassAssignment model
      const classResponse = await apiFetch({
        url: `/api/class-assignment/${classId}`,
        method: 'GET'
      });

      console.log('📋 Class assignment response:', classResponse.data);

      if (classResponse.data.status === 'success') {
        const assignment = classResponse.data.data;
        // Construct the proper classId format using consistent normalization
        // Convert semester number to "Sem X" format, but check if already has "Sem" prefix
        const semesterStr = typeof assignment.semester === 'number' 
          ? `Sem ${assignment.semester}` 
          : assignment.semester.startsWith('Sem') 
            ? assignment.semester 
            : `Sem ${assignment.semester}`;
        
        // Use the same normalization logic as backend
        const properClassId = `${assignment.batch}_${assignment.year}_${semesterStr}_${assignment.section || 'A'}`;
        
        console.log('🔧 Constructed classId:', properClassId);
        console.log('📋 Assignment data:', assignment);
        console.log('🔍 Semester processing:', {
          original: assignment.semester,
          type: typeof assignment.semester,
          converted: semesterStr
        });
        
        const newClassData = {
          classId: properClassId, // Use proper classId format for the new attendance management API
          _id: assignment._id, // Add the assignment ID for reports
          batch: assignment.batch,
          year: assignment.year,
          semester: semesterStr, // Use converted semester format
          section: assignment.section,
          department: user.department, // Use user's department instead of departmentId
          isArchived: assignment.status !== 'Active' || !assignment.active, // Check if class is archived
          status: assignment.status,
          active: assignment.active
        };
        
        console.log('🔍 Final classData semester:', {
          original: assignment.semester,
          converted: semesterStr,
          final: newClassData.semester
        });
        
        setClassData(newClassData);
        
        console.log('✅ Class data set:', newClassData);
        
        // Fetch students using the new classId-based API
        const studentsUrl = `/api/classes/${classId}/students`;
        
        console.log('📡 [NEW API] Fetching students with classId:', classId);
        console.log('📡 [NEW API] URL:', studentsUrl);
        
        const studentsResponse = await apiFetch({
          url: studentsUrl,
          method: 'GET'
        });

        console.log('👥 [NEW API] Students response:', studentsResponse.data);

        if (studentsResponse.data.success) {
          const fetchedStudents = studentsResponse.data.data.students || [];
          setStudents(fetchedStudents);
          console.log('✅ [NEW API] Students loaded:', fetchedStudents.length);
          console.log('📊 [NEW API] Sample student data:', fetchedStudents[0]);
          console.log('📋 [NEW API] Student fields:', fetchedStudents[0] ? Object.keys(fetchedStudents[0]) : 'No students');
          console.log('🔍 [NEW API] Roll number check:', {
            hasRollNumber: fetchedStudents[0]?.rollNumber,
            hasRegNo: fetchedStudents[0]?.regNo,
            studentName: fetchedStudents[0]?.name
          });
          
          // Update classData with archived status from API response
          if (studentsResponse.data.data.classInfo) {
            setClassData(prev => ({
              ...prev,
              isArchived: studentsResponse.data.data.classInfo.isArchived,
              status: studentsResponse.data.data.classInfo.status,
              active: studentsResponse.data.data.classInfo.active
            }));
          }
          
          if (fetchedStudents.length === 0) {
            console.log('ℹ️ [NEW API] No students found in this class');
            setToast({ 
              show: true, 
              message: 'No students enrolled in this class yet. Add students to get started.', 
              type: 'info' 
            });
          }
        } else {
          console.error('❌ [NEW API] Failed to fetch students:', studentsResponse.data.message);
          setToast({ 
            show: true, 
            message: studentsResponse.data.message || 'Failed to load students', 
            type: 'error' 
          });
        }
      } else {
        console.error('❌ Failed to fetch class assignment:', classResponse.data.message);
        setToast({ show: true, message: classResponse.data.message || 'Failed to load class data', type: 'error' });
      }
    } catch (error) {
      console.error('❌ Error fetching class data:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Error loading class data';
      if (error.response?.status === 403) {
        errorMessage = 'You are not authorized to access this class';
      } else if (error.response?.status === 404) {
        errorMessage = 'Class not found or has been removed';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/class-management');
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Icon components for tabs
  const TabIcon = ({ children, className = "w-5 h-5" }) => (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {children}
    </span>
  );

  const tabs = [
    { 
      id: 'mark', 
      label: 'Mark Attendance', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'edit', 
      label: 'Edit Attendance', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'history', 
      label: 'Attendance History', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'holidays', 
      label: 'Holiday Management', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'reviews', 
      label: 'Absence Reviews', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'absentee', 
      label: 'Absentee Report', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </TabIcon>
      )
    },
    { 
      id: 'students', 
      label: 'Student Management', 
      icon: (
        <TabIcon>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </TabIcon>
      )
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading class data...</p>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Class Not Found</h2>
          <p className="text-gray-600 mb-4">
            The requested class could not be found or you don't have access to it.
          </p>
          <p className="text-gray-500 mb-6">
            This might happen if:
            <br />• The class assignment was removed
            <br />• You don't have permission to access this class
            <br />• The class ID is invalid
          </p>
          <button
            onClick={handleBackToDashboard}
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

      {/* Header - Mobile Responsive */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={handleBackToDashboard}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                title="Back to Class Management"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="break-words">Class Management - {classData.batch} | {classData.year} | Semester {classData.semester} | Section {classData.section}</span>
                {classData.isArchived && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                    📦 Archived Class
                  </span>
                )}
              </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {classData.isArchived 
                    ? 'Viewing archived class - Read-only access for historical data' 
                    : 'Manage attendance, students, and generate reports for this class'}
                </p>
              </div>
            </div>
          </div>
        </div>
            </div>

      {/* Tab Navigation - Two-Row Grid on Mobile, Horizontal on Desktop */}
      <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile: 2-Row Grid Layout (< 768px) */}
          <nav className="md:hidden grid grid-cols-2 gap-2 py-2">
            {/* Row 1: 2 columns - Mark Attendance, Edit Attendance */}
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {tabs.filter(tab => ['mark', 'edit'].includes(tab.id)).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 py-3 font-medium text-xs transition-all duration-300 rounded-lg flex items-center justify-center gap-1.5 min-h-[48px] ${
                    activeTab === tab.id
                      ? 'text-white bg-blue-600 shadow-md'
                      : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 flex-1 justify-center">
                    <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`}>
                      {tab.icon}
                    </span>
                    <span className="font-semibold text-center leading-tight">{tab.label}</span>
                  </span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-b-lg"></div>
                  )}
                </button>
              ))}
            </div>
            {/* Row 2: 3 columns - Attendance History, Absentee Report, Student Management */}
            <div className="col-span-2 grid grid-cols-3 gap-2">
              {tabs.filter(tab => ['history', 'absentee', 'students'].includes(tab.id)).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-2 py-3 font-medium text-xs transition-all duration-300 rounded-lg flex flex-col items-center justify-center gap-1 min-h-[48px] ${
                    activeTab === tab.id
                      ? 'text-white bg-blue-600 shadow-md'
                      : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`}>
                    {tab.icon}
                  </span>
                  <span className="font-semibold text-center leading-tight text-[10px] sm:text-xs">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-b-lg"></div>
                  )}
                </button>
              ))}
            </div>
            {/* Additional tabs in a third row (Holiday Management, Absence Reviews) */}
            {tabs.filter(tab => ['holidays', 'reviews'].includes(tab.id)).length > 0 && (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                {tabs.filter(tab => ['holidays', 'reviews'].includes(tab.id)).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-3 py-3 font-medium text-xs transition-all duration-300 rounded-lg flex items-center justify-center gap-1.5 min-h-[48px] ${
                      activeTab === tab.id
                        ? 'text-white bg-blue-600 shadow-md'
                        : 'text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 flex-1 justify-center">
                      <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`}>
                        {tab.icon}
                      </span>
                      <span className="font-semibold text-center leading-tight">{tab.label}</span>
                    </span>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-b-lg"></div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </nav>

          {/* Desktop/Tablet: Horizontal Scrollable Layout (≥ 768px) */}
          <nav className="hidden md:flex overflow-x-auto scrollbar-hide space-x-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 font-medium text-sm md:text-base transition-all duration-300 rounded-lg flex-shrink-0 whitespace-nowrap flex items-center justify-center gap-2 min-h-[44px] ${
                  activeTab === tab.id
                    ? 'text-white bg-blue-600 shadow-md hover:bg-blue-700'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`}>
                    {tab.icon}
                  </span>
                  <span className="font-semibold">{tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-b-lg"></div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content - Mobile Responsive */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6">
        {activeTab === 'mark' && (
          <MarkAttendanceTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
            onStudentsUpdate={setStudents}
            navigate={navigate}
          />
        )}
        {activeTab === 'edit' && (
          <EditAttendanceTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
          />
        )}
        {activeTab === 'history' && (
          <AttendanceHistoryTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
          />
        )}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Holiday Management
                </h2>
                <button
                  onClick={() => setShowHolidayModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  + Declare Holiday
                </button>
              </div>
              
              <HolidayList 
                classData={classData}
                onHolidayUpdate={() => setHolidayRefreshKey(prev => prev + 1)}
                showActions={true}
                refreshKey={holidayRefreshKey}
              />
            </div>
          </div>
        )}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <AbsenceReasonReviewCard 
              department={classData?.department || user?.department}
              classId={classData?.classId}
            />
          </div>
        )}
        {activeTab === 'absentee' && (
          <AbsenteeReportTab 
            classData={classData}
            onToast={showToast}
          />
        )}
        {activeTab === 'students' && (
          <StudentManagementTab 
            classData={classData} 
            students={students} 
            onToast={showToast}
            onStudentsUpdate={setStudents}
            user={user}
            navigate={navigate}
          />
        )}
      </div>

      {/* Holiday Declaration Modal */}
      <HolidayDeclarationModal
        isOpen={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        onSuccess={(holiday) => {
          console.log('✅ Holiday declared successfully:', holiday);
          showToast('Holiday declared successfully!', 'success');
          setHolidayRefreshKey(prev => prev + 1);
          // Force refresh of holiday list by triggering a re-render
          setTimeout(() => {
            // This will cause HolidayList to re-fetch
            setHolidayRefreshKey(prev => prev + 1);
          }, 500);
        }}
        classData={classData}
      />
    </div>
  );
};

// Mark Attendance Tab Component
const MarkAttendanceTab = ({ classData, students, onToast, onStudentsUpdate, navigate }) => {
  const [attendanceForm, setAttendanceForm] = useState({
    absentees: '',
    odStudents: ''
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceExists, setAttendanceExists] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [checkingHoliday, setCheckingHoliday] = useState(true);

  // Check if today is a holiday
  const checkHolidayStatus = async () => {
    if (!classData) return;
    
    try {
      setCheckingHoliday(true);
      const today = new Date().toISOString().split('T')[0];
      const queryParams = new URLSearchParams({
        batchYear: classData.batch,
        section: classData.section,
        semester: classData.semester
      });

      const response = await apiFetch({
        url: `/api/holidays/check/${today}?${queryParams}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setIsHoliday(response.data.data.isHoliday);
        setHolidayInfo(response.data.data.holiday);
      }
    } catch (error) {
      console.error('Error checking holiday status:', error);
    } finally {
      setCheckingHoliday(false);
    }
  };

  // Check attendance status when component loads
  useEffect(() => {
    if (classData?.classId) {
      console.log('📋 Component loaded, checking attendance for class:', classData.classId);
      console.log('📋 Full class data:', classData);
      checkAttendanceExists();
      checkHolidayStatus();
    } else {
      console.log('📋 No class data available yet');
    }
  }, [classData?.classId]);

  // Refresh attendance data when students are loaded
  useEffect(() => {
    if (students && students.length > 0 && classData?.classId) {
      console.log('📋 Students loaded, refreshing attendance data');
      checkAttendanceExists();
    }
  }, [students, classData?.classId]);

  // Debug attendance state changes
  useEffect(() => {
    console.log('📋 Attendance state changed:', {
      attendanceExists,
      todayAttendance,
      checkingAttendance
    });
  }, [attendanceExists, todayAttendance, checkingAttendance]);

  // Force re-render when attendance data changes
  useEffect(() => {
    if (todayAttendance) {
      console.log('📋 Attendance data updated, forcing re-render');
      console.log('📋 Present students for display:', todayAttendance.presentStudents);
      console.log('📋 Absent students for display:', todayAttendance.absentStudents);
    }
  }, [todayAttendance]);

  // Auto-refresh attendance data when there are pending ODs
  useEffect(() => {
    if (!attendanceExists || !classData?.classId) return;
    
    const pendingODCount = todayAttendance?.pendingODCount || 0;
    
    // Only auto-refresh if there are pending ODs
    if (pendingODCount > 0) {
      console.log('🔄 Auto-refreshing attendance data due to pending ODs:', pendingODCount);
      
      // Refresh every 10 seconds when there are pending ODs
      const refreshInterval = setInterval(() => {
        checkAttendanceExists();
      }, 10000); // 10 seconds
      
      return () => clearInterval(refreshInterval);
    }
  }, [attendanceExists, todayAttendance?.pendingODCount, classData?.classId]);

  const handleAttendanceChange = (e) => {
    const { name, value } = e.target;
    setAttendanceForm(prev => ({ ...prev, [name]: value }));
  };

  // Calculate present count in real-time
  const absentCount = attendanceForm.absentees.split(',').filter(id => id.trim()).length;
  const odCount = attendanceForm.odStudents.split(',').filter(id => id.trim()).length;
  const presentCount = Math.max(0, (students?.length || 0) - absentCount - odCount);

  // Helper function to get attendance status for a student
  const getStudentAttendanceStatus = (rollNumber) => {
    console.log('📋 Getting status for roll number:', rollNumber);
    console.log('📋 Current todayAttendance:', todayAttendance);
    console.log('📋 Force update value:', forceUpdate);
    
    if (!todayAttendance) {
      console.log('📋 No attendance data for roll number:', rollNumber);
      return { status: 'Not Marked', hasPendingOD: false };
    }
    
    // Ensure we have arrays to work with
    const presentStudents = Array.isArray(todayAttendance.presentStudents) ? todayAttendance.presentStudents : [];
    const absentStudents = Array.isArray(todayAttendance.absentStudents) ? todayAttendance.absentStudents : [];
    const odStudents = Array.isArray(todayAttendance.odStudents) ? todayAttendance.odStudents : [];
    
    // Also check records array if present (from API response)
    let statusFromRecords = null;
    let hasPendingOD = false;
    if (todayAttendance.records && Array.isArray(todayAttendance.records)) {
      const record = todayAttendance.records.find(r => {
        const rollNum = r.rollNumber || (r.studentId && (r.studentId.rollNumber || r.studentId.rollNo || r.studentId.regNo));
        return rollNum === rollNumber;
      });
      if (record) {
        statusFromRecords = record.status;
        hasPendingOD = record.pendingOD === true;
      }
    }
    
    const isPresent = presentStudents.includes(rollNumber);
    const isAbsent = absentStudents.includes(rollNumber);
    const isOD = odStudents.includes(rollNumber) || statusFromRecords === 'od' || statusFromRecords === 'OD';
    
    console.log('📋 Attendance check for', rollNumber, ':', {
      isPresent,
      isAbsent,
      isOD,
      hasPendingOD,
      presentStudents: presentStudents,
      absentStudents: absentStudents,
      odStudents: odStudents,
      statusFromRecords,
      fullAttendanceData: todayAttendance
    });
    
    if (isPresent && !isOD) return { status: 'Present', hasPendingOD: false };
    if (isOD) return { status: 'OD', hasPendingOD };
    if (isAbsent) return { status: 'Absent', hasPendingOD: false };
    return { status: 'Not Marked', hasPendingOD: false };
  };

  // Function to check if attendance already exists and fetch attendance data
  const checkAttendanceExists = async () => {
    try {
      setCheckingAttendance(true);
      const today = new Date();
      const todayISO = today.toISOString().split('T')[0];
      
      console.log('📋 Checking attendance for date:', todayISO);
      console.log('📋 Class ID being used:', classData.classId);
      
      // Try the new attendance API first
      try {
        const response = await apiFetch({
          url: `/api/attendance/${encodeURIComponent(classData.classId)}/${todayISO}`,
          method: 'GET'
        });
        
        if (response.data.success) {
          const attendance = response.data.data.attendance;
          console.log('📋 Found attendance using new API:', attendance);
          
          // Transform new API data to match frontend expectations
          const presentStudents = attendance.records
            .filter(record => record.status === 'present')
            .map(record => record.rollNumber);
          
          const absentStudents = attendance.records
            .filter(record => record.status === 'absent')
            .map(record => record.rollNumber);
          
          const odStudents = attendance.records
            .filter(record => record.status === 'od')
            .map(record => record.rollNumber);
          
          // Count pending ODs
          const pendingODCount = attendance.records?.filter(r => r.pendingOD === true).length || 0;
          
          const attendanceData = {
            presentStudents: presentStudents,
            absentStudents: absentStudents,
            odStudents: odStudents,
            totalStudents: attendance.totalStudents || 0,
            totalPresent: attendance.totalPresent || 0,
            totalAbsent: attendance.totalAbsent || 0,
            totalOD: attendance.totalOD || 0,
            pendingODCount: pendingODCount,
            date: attendance.date,
            status: attendance.status,
            records: attendance.records // Keep records for status checking
          };
          
          setTodayAttendance(attendanceData);
          setAttendanceExists(true);
          console.log('📋 Processed attendance data from new API:', attendanceData);
          console.log('📋 Present students array:', attendanceData.presentStudents);
          console.log('📋 Absent students array:', attendanceData.absentStudents);
          return; // Success, exit early
        }
      } catch (newApiError) {
        console.log('📋 New API not available, trying old API:', newApiError.message);
      }
      
      // Fallback to old API
      const response = await apiFetch({
        url: `/api/attendance-management/check?classId=${encodeURIComponent(classData.classId)}&date=${todayISO}`,
        method: 'GET'
      });
      
      if (response.data.success) {
        const { exists, attendance } = response.data.data;
        console.log('📋 Raw response from check endpoint:', response.data.data);
        console.log('📋 Attendance exists:', exists);
        console.log('📋 Raw attendance object:', attendance);
        
        setAttendanceExists(exists);
        
        if (attendance) {
          // Transform attendance data to match frontend expectations
          // Count pending ODs from records
          const pendingODCount = attendance.records?.filter(r => r.pendingOD === true).length || 0;
          
          const attendanceData = {
            presentStudents: attendance.presentStudents || [],
            absentStudents: attendance.absentStudents || [],
            odStudents: attendance.odStudents || [],
            totalStudents: attendance.totalStudents || 0,
            totalPresent: attendance.totalPresent || 0,
            totalAbsent: attendance.totalAbsent || 0,
            totalOD: attendance.totalOD || 0,
            pendingODCount: pendingODCount,
            date: attendance.date,
            status: attendance.status,
            records: attendance.records || [] // Keep records if available
          };
          setTodayAttendance(attendanceData);
          console.log('📋 Processed attendance data from old API:', attendanceData);
          console.log('📋 Present students array:', attendanceData.presentStudents);
          console.log('📋 Absent students array:', attendanceData.absentStudents);
          console.log('📋 OD students array:', attendanceData.odStudents);
        } else {
          setTodayAttendance(null);
          console.log('📋 No attendance data found for today');
        }
      }
    } catch (error) {
      console.error('❌ Error checking attendance:', error);
      setAttendanceExists(false);
      setTodayAttendance(null);
    } finally {
      setCheckingAttendance(false);
    }
  };

  // Function to refresh students list
  const refreshStudentsList = async () => {
    if (!classData?.classId) {
      console.error('❌ [NEW API] No classId available');
      return;
    }
    
    try {
      console.log('🔄 [NEW API] Refreshing students list using classId:', classData.classId);
      const studentsResponse = await apiFetch({
        url: `/api/classes/${classData.classId}/students`,
        method: 'GET'
      });
      
      if (studentsResponse.data.success) {
        const refreshedStudents = studentsResponse.data.data.students || [];
        console.log('✅ [NEW API] Students refreshed:', refreshedStudents.length);
        onStudentsUpdate(refreshedStudents);
        onToast(`Student list refreshed: ${refreshedStudents.length} student(s)`, 'success');
      } else {
        console.error('❌ [NEW API] Failed to refresh students:', studentsResponse.data.message);
        onToast(studentsResponse.data.message || 'Failed to refresh student list', 'error');
      }
    } catch (error) {
      console.error('❌ [NEW API] Error refreshing students list:', error);
      
      let errorMessage = 'Failed to refresh student list';
      if (error.response?.status === 403) {
        errorMessage = error.response.data?.message || 'Access denied: Not authorized to view these students';
      } else if (error.response?.status === 404) {
        errorMessage = error.response.data?.message || 'Class not found';
      } else if (error.response?.status === 500) {
        errorMessage = error.response.data?.message || 'Server error: Please try again';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      onToast(errorMessage, 'error');
    }
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    setAttendanceLoading(true);

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      console.log('📅 Frontend date calculation:', {
        today: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      // Convert absentees string to array of roll numbers
      const absentRollNumbers = attendanceForm.absentees
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      // Convert OD students string to array of roll numbers
      const odRollNumbers = attendanceForm.odStudents
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      // Validate that all roll numbers exist in the student list
      const studentRollNumbers = (students || []).map(s => s.rollNumber);
      const allInputRollNumbers = [...absentRollNumbers, ...odRollNumbers];
      const invalidRollNumbers = allInputRollNumbers.filter(roll => !studentRollNumbers.includes(roll));
      
      if (invalidRollNumbers.length > 0) {
        onToast(`Invalid roll numbers not found in class: ${invalidRollNumbers.join(', ')}`, 'error');
        setAttendanceLoading(false);
        return;
      }

      // Check for overlapping roll numbers
      const overlappingRollNumbers = absentRollNumbers.filter(roll => odRollNumbers.includes(roll));
      if (overlappingRollNumbers.length > 0) {
        onToast(`Roll numbers cannot be both absent and OD: ${overlappingRollNumbers.join(', ')}`, 'error');
        setAttendanceLoading(false);
        return;
      }

      // Create attendance records for all students
      const records = (students || []).map(student => {
        const rollNum = student.rollNumber;
        let status = 'present';
        if (absentRollNumbers.includes(rollNum)) {
          status = 'absent';
        } else if (odRollNumbers.includes(rollNum)) {
          status = 'od';
        }
        return {
        studentId: student._id,
          status: status
        };
      });

      const requestData = {
        records: records,
        notes: attendanceForm.notes || ''
      };

      console.log('📤 Sending attendance data:', requestData);

      const response = await apiFetch({
        url: `/api/attendance/${encodeURIComponent(classData.classId)}/${today}`,
        method: 'POST',
        data: requestData
      });

      if (response.data.success) {
        // Check if there are pending OD approvals
        const pendingODCount = response.data.data?.approvalRequests?.length || 0;
        const hasPendingOD = pendingODCount > 0;
        
        if (hasPendingOD) {
          onToast(`✅ Attendance marked successfully! ${pendingODCount} OD request(s) sent for Principal approval.`, 'success');
        } else {
          onToast('✅ Attendance marked successfully!', 'success');
        }
        
        setAttendanceForm(prev => ({ ...prev, absentees: '', odStudents: '' }));
        
        // Refresh attendance data from API to get accurate records with pendingOD flags
        await checkAttendanceExists();
        
        // Refresh students list
        await refreshStudentsList();
      } else {
        onToast(response.data.message || 'Failed to mark attendance', 'error');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error marking attendance. Please try again.';
      
      if (error.response?.data?.msg === 'Token expired.') {
        errorMessage = 'Your session has expired. Please log in again.';
        // Redirect to login after showing error
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }
      
      onToast(errorMessage, 'error');
    } finally {
      setAttendanceLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Mark Daily Attendance</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Mark attendance for today's class</p>
              {checkingHoliday ? (
                <p className="text-xs sm:text-sm text-blue-500 mt-2">Checking holiday status...</p>
              ) : isHoliday ? (
                <div className="mt-2 p-2 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-start sm:items-center gap-2">
                    <span className="text-yellow-600 text-base sm:text-lg flex-shrink-0">🎉</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-yellow-800">
                        Today is a holiday: {holidayInfo?.reason}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        {holidayInfo?.scope === 'global' ? 'Global holiday' : 'Class holiday'} - 
                        Cannot mark attendance
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => {
                checkAttendanceExists();
                checkHolidayStatus();
              }}
              disabled={checkingAttendance || checkingHoliday}
              className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {checkingAttendance || checkingHoliday ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>
        </div>
      <div className="p-4 sm:p-6">
        {isHoliday ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Holiday - No Class Today
            </h3>
            <p className="text-gray-600 mb-4">
              {holidayInfo?.reason} - Attendance cannot be marked on holidays
            </p>
            <p className="text-sm text-gray-500">
              Use the Holiday Management tab to view or manage holidays
            </p>
          </div>
        ) : (
          <form onSubmit={handleMarkAttendance} className="space-y-4 sm:space-y-6">
          {/* Date and Stats Section - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
                <input 
                type="text"
                  name="date" 
                value={new Date().toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })}
                readOnly
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Today's date - attendance can only be marked for today</p>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Total Students Present
              </label>
              <input
                type="number"
                name="present"
                value={presentCount}
                readOnly
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>

            {/* Stats Cards - Stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-green-700 font-medium mb-1">Present</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{presentCount}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-red-700 font-medium mb-1">Absent</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{absentCount}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-blue-700 font-medium mb-1">
                OD {todayAttendance?.pendingODCount > 0 && (
                  <span className="text-yellow-600 text-xs">({todayAttendance.pendingODCount} pending)</span>
                )}
              </p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {todayAttendance?.pendingODCount > 0 ? `${odCount - todayAttendance.pendingODCount}` : odCount}
                  {todayAttendance?.pendingODCount > 0 && (
                    <span className="text-yellow-600 text-xs ml-1">+{todayAttendance.pendingODCount}</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Absent Students (Enter roll numbers separated by commas)
              </label>
              <textarea
                name="absentees"
                value={attendanceForm.absentees}
                onChange={handleAttendanceChange}
              placeholder="e.g., STU001, STU003, STU005"
                rows={3}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                  On Duty (OD) Students (Enter roll numbers separated by commas)
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/faculty/od-request')}
                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs sm:text-sm shadow-sm hover:shadow-md whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Request Future OD</span>
                </button>
              </div>
              <textarea
                name="odStudents"
                value={attendanceForm.odStudents}
                onChange={handleAttendanceChange}
              placeholder="e.g., STU002, STU004, STU006"
                rows={3}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="text-xs text-gray-500 mt-1">
                For same-day OD, enter roll numbers above. For future dates, use "Request Future OD" button.
              </p>
            </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  type="submit"
                  disabled={attendanceLoading || attendanceExists || checkingAttendance}
                  className={`w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-md font-medium text-sm sm:text-base transition-colors ${
                    attendanceExists 
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                  onClick={() => {
                    console.log('📋 Button clicked - State:', {
                      attendanceLoading,
                      attendanceExists,
                      checkingAttendance,
                      todayAttendance
                    });
                  }}
                >
                  {checkingAttendance ? 'Checking...' : 
                   attendanceLoading ? 'Marking...' : 
                   attendanceExists ? 'Already Marked Today' : 
                   'Mark Attendance'}
                </button>
            </div>
          </form>
        )}

        {/* Students List - Responsive Table/Cards */}
        <div className="mt-6 sm:mt-8">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Students in Class</h3>
          
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table key={`attendance-table-${forceUpdate}`} className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll Number
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Today's Attendance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(students || []).map((student) => (
                <tr key={student._id || student.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.rollNumber || student.regNo || student.rollNo || 'N/A'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const studentId = student._id || student.id;
                          console.log('🔗 Navigating to student profile:', studentId);
                          console.log('👤 Student data:', student);
                          console.log('🔍 Current URL:', window.location.href);
                          console.log('🔍 Target URL:', `/student-detail/${studentId}`);
                          
                          // Test if navigate function is working
                          try {
                            navigate(`/student-detail/${studentId}`);
                            console.log('✅ Navigation called successfully');
                          } catch (error) {
                            console.error('❌ Navigation error:', error);
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                      >
                        {student.name}
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 break-all">
                      {student.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const rollNum = student.rollNumber || student.regNo || student.rollNo;
                        const statusInfo = getStudentAttendanceStatus(rollNum);
                        const status = statusInfo.status;
                        const hasPendingOD = statusInfo.hasPendingOD;
                        const statusColors = {
                          'Present': 'bg-green-100 text-green-800',
                          'Absent': 'bg-red-100 text-red-800',
                          'OD': 'bg-blue-100 text-blue-800',
                          'OD (Pending Approval)': 'bg-yellow-100 text-yellow-800',
                          'On Duty': 'bg-blue-100 text-blue-800',
                          'Not Marked': 'bg-gray-100 text-gray-800'
                        };
                        
                        // Normalize status display (handle both 'OD' and 'On Duty')
                        const displayStatus = hasPendingOD 
                          ? 'OD (Pending Approval)' 
                          : (status === 'od' || status === 'OD' ? 'OD' : status);
                        return (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[displayStatus] || statusColors['Not Marked']}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View - Shown on mobile/tablet */}
        <div className="md:hidden space-y-3">
          {(students || []).map((student) => {
            const rollNum = student.rollNumber || student.regNo || student.rollNo;
            const statusInfo = getStudentAttendanceStatus(rollNum);
            const status = statusInfo.status;
            const hasPendingOD = statusInfo.hasPendingOD;
            const statusColors = {
              'Present': 'bg-green-100 text-green-800 border-green-200',
              'Absent': 'bg-red-100 text-red-800 border-red-200',
              'OD': 'bg-blue-100 text-blue-800 border-blue-200',
              'OD (Pending Approval)': 'bg-yellow-100 text-yellow-800 border-yellow-200',
              'On Duty': 'bg-blue-100 text-blue-800 border-blue-200',
              'Not Marked': 'bg-gray-100 text-gray-800 border-gray-200'
            };
            const displayStatus = hasPendingOD 
              ? 'OD (Pending Approval)' 
              : (status === 'od' || status === 'OD' ? 'OD' : status);
            
            return (
              <div key={student._id || student.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-medium text-gray-500">Roll Number:</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {student.rollNumber || student.regNo || student.rollNo || 'N/A'}
                        </p>
                      </div>
                      <div className="mb-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const studentId = student._id || student.id;
                            navigate(`/student-detail/${studentId}`);
                          }}
                          className="text-sm sm:text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {student.name}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-500">Email:</p>
                        <p className="text-xs sm:text-sm text-gray-600 break-all">{student.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex px-2.5 py-1.5 text-xs font-semibold rounded-full border ${statusColors[displayStatus] || statusColors['Not Marked']} flex-shrink-0`}>
                      {displayStatus}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
};

// Edit Attendance Tab Component
const EditAttendanceTab = ({ classData, students, onToast }) => {
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [studentRecords, setStudentRecords] = useState([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (classData?.classId) {
      fetchTodayAttendance();
    }
  }, [classData?.classId]);

  // Update student records when students prop changes or attendance data changes
  useEffect(() => {
    if (students && students.length > 0) {
      console.log('📋 [EDIT] Students available:', students.length);
      console.log('📋 [EDIT] Attendance data:', attendanceData);
      
      // If we have attendance data, merge with students
      if (attendanceData && attendanceData.records && attendanceData.records.length > 0) {
        console.log('📋 [EDIT] Merging attendance with students');
        const records = attendanceData.records.map(record => ({
          studentId: record.studentId._id || record.studentId,
          rollNumber: record.rollNumber,
          name: record.name,
          email: record.email || 'N/A',
          status: record.status
        }));
        setStudentRecords(records);
      } else {
        // No attendance record yet, use students from props with default "present" status
        console.log('📋 [EDIT] No attendance records, using students with default status');
        const records = students.map(student => ({
          studentId: student._id,
          rollNumber: student.rollNumber || student.regNo || student.rollNo || 'N/A',
          name: student.name,
          email: student.email || 'N/A',
          status: 'present' // Default status
        }));
        setStudentRecords(records);
        console.log('📋 [EDIT] Created', records.length, 'student records');
      }
    }
  }, [students, attendanceData]);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      console.log('📋 Fetching today\'s attendance for class:', classData.classId);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      const response = await apiFetch({
        url: `/api/attendance/${encodeURIComponent(classData.classId)}/${today}`,
        method: 'GET'
      });

      console.log('📋 API Response:', response);

      if (response.data.success) {
        const attendance = response.data.data.attendance;
        setAttendanceData(attendance);
        setNotes(attendance.notes || '');
        console.log('📋 Today\'s attendance loaded:', attendance);
        // Note: studentRecords will be set by the useEffect that watches students + attendanceData
      } else {
        console.log('📋 No attendance found:', response.data.message);
        setAttendanceData(null);
        // Note: studentRecords will be set by the useEffect that watches students + attendanceData
      }
    } catch (error) {
      console.error('❌ Error fetching today\'s attendance:', error);
      
      if (error.response?.status === 404) {
        // No attendance record found - this is expected if not marked yet
        console.log('📋 No attendance record found for today - this is expected if attendance hasn\'t been marked yet');
        setAttendanceData(null);
        // Note: studentRecords will be set by the useEffect that watches students + attendanceData
      } else {
        let errorMessage = 'Error loading today\'s attendance';
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Check for authentication errors
        if (error.response?.status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else if (error.response?.status === 403) {
          errorMessage = 'Access denied. You do not have permission to view this data.';
        } else if (error.response?.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        onToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    setStudentRecords(prev => 
      prev.map(record => 
        record.studentId === studentId 
          ? { ...record, status: newStatus }
          : record
      )
    );
  };

  const handleUpdateAttendance = async (e) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Convert student records to API format
      const records = studentRecords.map(record => ({
        studentId: record.studentId,
        status: record.status
      }));

      console.log('📋 Updating attendance with data:', {
        classId: classData.classId,
        date: today,
        recordsCount: records.length,
        notes: notes
      });

      const response = await apiFetch({
        url: `/api/attendance/${encodeURIComponent(classData.classId)}/${today}`,
        method: 'PUT',
        data: {
          records: records,
          notes: notes
        }
      });

      if (response.data.success) {
        // Check if there are pending OD approvals
        const pendingODCount = response.data.data?.approvalRequests?.length || 0;
        const hasPendingOD = pendingODCount > 0;
        
        if (hasPendingOD) {
          onToast(`✅ Attendance updated successfully! ${pendingODCount} OD request(s) sent for Principal approval.`, 'success');
        } else {
          onToast('✅ Attendance updated successfully for today!', 'success');
        }
        
        // Update local state with new data
        const updatedAttendance = response.data.data.attendance;
        setAttendanceData(updatedAttendance);
        
        // Update student records
        const updatedRecords = updatedAttendance.records.map(record => ({
          studentId: record.studentId._id || record.studentId,
          rollNumber: record.rollNumber,
          name: record.name,
          email: record.email || 'N/A',
          status: record.status
        }));
        setStudentRecords(updatedRecords);
        
        console.log('📋 Attendance updated:', response.data.data);
      } else {
        onToast(response.data.message || 'Failed to update attendance', 'error');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error updating attendance';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Check for specific error cases
      if (error.response?.status === 404) {
        errorMessage = 'Attendance record not found. Please mark attendance first.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data.message || 'Invalid data provided.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      
      onToast(errorMessage, 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  // Don't show "No Attendance" message if we have students to display
  // The students will show with default status and can be marked/edited
  const showNoAttendanceMessage = !attendanceData && (!studentRecords || studentRecords.length === 0);
  
  if (showNoAttendanceMessage) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Edit Today's Attendance</h2>
          <p className="text-sm text-gray-500">Modify today's attendance record</p>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Students or Attendance Found</h3>
            <p className="text-gray-500 mb-4">No students or attendance records are available for this class.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Possible reasons:</h4>
              <ul className="text-sm text-blue-800 text-left space-y-1">
                <li>• No students have been enrolled in this class</li>
                <li>• Go to "Student Management" tab to add students</li>
                <li>• Then mark attendance in "Mark Attendance" tab</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Edit Form */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-medium text-gray-900">Edit Today's Attendance</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Modify today's attendance record</p>
        </div>
        <div className="p-4 sm:p-6">
          <form onSubmit={handleUpdateAttendance} className="space-y-4 sm:space-y-6">
            {/* Summary - show actual data if attendance exists, otherwise show current counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Date</label>
                <p className="mt-1 text-xs sm:text-sm text-gray-900">
                  {attendanceData 
                    ? new Date(attendanceData.date).toLocaleDateString()
                    : new Date().toLocaleDateString()}
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Total</label>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-gray-900">
                  {attendanceData ? attendanceData.totalStudents : studentRecords.length}
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Present</label>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-green-600">
                  {attendanceData 
                    ? attendanceData.totalPresent 
                    : studentRecords.filter(s => s.status === 'present').length}
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">OD</label>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-blue-600">
                  {attendanceData 
                    ? (attendanceData.totalOD || 0)
                    : studentRecords.filter(s => s.status === 'od').length}
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700">Absent</label>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-red-600">
                  {attendanceData 
                    ? attendanceData.totalAbsent 
                    : studentRecords.filter(s => s.status === 'absent').length}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-xs sm:text-sm font-medium text-gray-700">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-y"
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={updating}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updating ? 'Updating...' : 'Update Attendance'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Students List with Status Toggles - Responsive */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-medium text-gray-900">Students in Class</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Toggle attendance status for each student</p>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roll Number
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {studentRecords.map((student) => (
                <tr key={student.studentId} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.rollNumber}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.name}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 break-all">
                    {student.email || 'N/A'}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'present')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          student.status === 'present'
                            ? 'bg-green-100 text-green-800 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'od')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          student.status === 'od'
                            ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
                        }`}
                      >
                        OD
                      </button>
                      <button
                        onClick={() => handleStatusChange(student.studentId, 'absent')}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          student.status === 'absent'
                            ? 'bg-red-100 text-red-800 border-2 border-red-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 p-4">
          {studentRecords.map((student) => (
            <div key={student.studentId} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-medium text-gray-500">Roll:</p>
                      <p className="text-sm font-semibold text-gray-900">{student.rollNumber}</p>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-gray-900 mb-1">{student.name}</p>
                    <p className="text-xs text-gray-600 break-all">{student.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-gray-700">Status:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStatusChange(student.studentId, 'present')}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        student.status === 'present'
                          ? 'bg-green-100 text-green-800 border-2 border-green-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-green-50'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => handleStatusChange(student.studentId, 'od')}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        student.status === 'od'
                          ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
                      }`}
                    >
                      OD
                    </button>
                    <button
                      onClick={() => handleStatusChange(student.studentId, 'absent')}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        student.status === 'absent'
                          ? 'bg-red-100 text-red-800 border-2 border-red-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-red-50'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Enhanced Attendance History Tab Component
const AttendanceHistoryTab = ({ classData, students, onToast }) => {
  const { user } = useAuth(); // Add useAuth hook to access user data
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [rangeAttendanceData, setRangeAttendanceData] = useState([]);
  const [workingDays, setWorkingDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('single'); // 'single', 'weekly', 'monthly'
  
  // Auto-set date ranges when view mode changes
  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    
    // Get today's date components in local timezone
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    
    // Create today's date string in YYYY-MM-DD format directly from components
    // This avoids timezone conversion issues
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;
    
    if (newViewMode === 'weekly') {
      // Calculate 7 days ago from today using date components
      const sevenDaysAgo = new Date(todayYear, todayMonth, todayDate - 7);
      const sevenDaysAgoYear = sevenDaysAgo.getFullYear();
      const sevenDaysAgoMonth = sevenDaysAgo.getMonth();
      const sevenDaysAgoDate = sevenDaysAgo.getDate();
      const sevenDaysAgoStr = `${sevenDaysAgoYear}-${String(sevenDaysAgoMonth + 1).padStart(2, '0')}-${String(sevenDaysAgoDate).padStart(2, '0')}`;
      
      setDateRange({
        startDate: sevenDaysAgoStr,
        endDate: todayStr
      });
      
      console.log('📅 Weekly view: Set date range to 7 days ago', {
        startDate: sevenDaysAgoStr,
        endDate: todayStr,
        daysDifference: 7
      });
      
    } else if (newViewMode === 'monthly') {
      // Calculate first day of current month using explicit date construction
      // This ensures we always get the 1st day of the current month regardless of timezone
      const firstDayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-01`;
      
      setDateRange({
        startDate: firstDayStr,
        endDate: todayStr
      });
      
      console.log('📅 Monthly view: Set date range to month-to-date', {
        startDate: firstDayStr,
        endDate: todayStr,
        month: todayMonth + 1,
        year: todayYear
      });
      
    } else if (newViewMode === 'single') {
      // For single date view, set today as default
      setSingleDate(todayStr);
      
      console.log('📅 Single view: Set date to today', {
        singleDate: todayStr
      });
    }
  };
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentSummaries, setStudentSummaries] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalStudents: 0,
    totalWorkingDays: 0,
    averageAttendance: 0,
    highestAttendance: { name: '', percentage: 0 },
    lowestAttendance: { name: '', percentage: 0 }
  });
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (classData?.classId) {
      fetchAttendanceHistory();
    }
  }, [viewMode, dateRange, singleDate, classData?.classId]);
  
  // Auto-fetch data when view mode changes (after date ranges are set)
  useEffect(() => {
    if (classData?.classId && (viewMode === 'weekly' || viewMode === 'monthly')) {
      // Small delay to ensure state updates are complete
      const timer = setTimeout(() => {
        fetchAttendanceHistory();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [viewMode, classData?.classId]);


  const fetchAttendanceHistory = useCallback(async () => {
    if (viewMode !== 'single' && !validateDateRange()) {
      console.log('⚠️ Date range validation failed');
      return;
    }
    
    // Validate date is not in the future
    if (viewMode === 'single') {
      if (!isValidDate(singleDate)) {
        setError('Please select a valid date');
        onToast('Please select a valid date', 'error');
        return;
      }
      
      // Temporarily allow future dates for testing
      // if (isDateInFuture(singleDate)) {
      //   setError('Cannot view attendance for future dates');
      //   onToast('Cannot view attendance for future dates', 'error');
      //   return;
      // }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      if (viewMode === 'single') {
        // Use the new standardized history-by-class endpoint for single date view
        const [batch, year, semester, section] = classData.classId.split('_');
        
        // Ensure date is in YYYY-MM-DD format
        const formattedDate = formatDateForAPI(singleDate);
        
        const url = `/api/attendance/history-by-class?batch=${encodeURIComponent(batch)}&year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}&section=${encodeURIComponent(section)}&date=${formattedDate}`;
        
        console.log('📊 Fetching single date attendance history:', { url, singleDate, formattedDate });
        
        response = await apiFetch({
          url: url,
          method: 'GET'
        });
        
        // Handle the standardized response format
        if (response.data.status === 'success') {
          const attendanceRecords = response.data.data || [];
          const summary = response.data.summary || {};
          
          // Convert to the format expected by the UI
          const formattedRecords = attendanceRecords.map(record => ({
            rollNo: record.rollNo,
            name: record.name,
            email: record.email,
            date: record.date,
            status: record.status,
            remarks: record.remarks,
            markedBy: record.markedBy,
            timestamp: record.timestamp,
            reviewStatus: record.reviewStatus,
            facultyNote: record.facultyNote
          }));
          
          setAttendanceHistory(formattedRecords);
          
          // Set summary stats
          setSummaryStats({
            totalStudents: summary.totalStudents || formattedRecords.length,
            totalWorkingDays: 1, // Single date view
            averageAttendance: summary.attendancePercentage || 0,
            highestAttendance: { name: '', percentage: 0 },
            lowestAttendance: { name: '', percentage: 0 }
          });
          
          console.log('✅ Successfully loaded attendance records:', formattedRecords.length);
        } else {
          setError(response.data.message || 'No attendance records found');
          setAttendanceHistory([]);
          setSummaryStats({
            totalStudents: 0,
            totalWorkingDays: 0,
            averageAttendance: 0,
            highestAttendance: { name: '', percentage: 0 },
            lowestAttendance: { name: '', percentage: 0 }
          });
        }
      } else {
        // Use the new history-range endpoint for date range view
        const [batch, year, semester, section] = classData.classId.split('_');
        
        // Ensure dates are in YYYY-MM-DD format
        const formattedStartDate = formatDateForAPI(dateRange.startDate);
        const formattedEndDate = formatDateForAPI(dateRange.endDate);
        
        const url = `/api/attendance/history-range?batch=${encodeURIComponent(batch)}&year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}&section=${encodeURIComponent(section)}&startDate=${formattedStartDate}&endDate=${formattedEndDate}&viewMode=${viewMode}`;
        
        console.log('📊 Fetching date range attendance history:', { url, viewMode });

        response = await apiFetch({
          url: url,
          method: 'GET'
        });
        
        // Handle the standardized response format
        if (response.data.status === 'success') {
          const data = response.data.data;
          
          // Process and unify the attendance data for both UI and export
          let processedStudents;
          
          // Try the new processing first
          if (data.students && data.students.length > 0) {
            const workingDaysCount = data.workingDays ? data.workingDays.length : 0;
            processedStudents = processAttendanceData(data.students, students, workingDaysCount);
          } else {
            // Fallback: use the existing calculation method
            console.log('🔄 Using fallback calculation method');
            const records = data.records || [];
            const summaries = calculateStudentSummaries(records, students);
            processedStudents = summaries;
          }
          
          // Set the range attendance data
          setRangeAttendanceData(processedStudents);
          setWorkingDays(data.workingDays || []);
          
          // Set analytics
          if (data.analytics) {
            setSummaryStats({
              totalStudents: data.analytics.totalStudents,
              totalWorkingDays: data.analytics.totalWorkingDays,
              averageAttendance: data.analytics.averageAttendance,
              highestAttendance: data.analytics.highestAttendance,
              lowestAttendance: data.analytics.lowestAttendance
            });
          }
          
          console.log('✅ Successfully loaded and processed range attendance data:', {
            studentsCount: processedStudents?.length || 0,
            workingDaysCount: data.workingDays?.length || 0,
            processedStudents: processedStudents,
            workingDays: data.workingDays,
            analytics: data.analytics
          });
          
        } else {
          setError(response.data.message || 'No attendance data found for the selected date range');
          setRangeAttendanceData([]);
          setWorkingDays([]);
          setSummaryStats({
            totalStudents: 0,
            totalWorkingDays: 0,
            averageAttendance: 0,
            highestAttendance: { name: '', percentage: 0 },
            lowestAttendance: { name: '', percentage: 0 }
          });
        }
      }
    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      
      let errorMessage = 'Error loading attendance history';
      
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to view this data.';
      } else if (error.response?.status === 404) {
        errorMessage = 'No attendance records found for the selected date range.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
      onToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [viewMode, dateRange.startDate, dateRange.endDate, singleDate, classData?.classId, onToast]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchAttendanceHistory();
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAttendanceHistory]);

  // Helper function to ensure dates are properly formatted for API calls
  const formatDateForAPI = (dateString) => {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // If it's in DD-MM-YYYY format, convert to YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split('-');
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse as date and return in YYYY-MM-DD format
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error parsing date for API:', error);
    }
    
    return dateString; // Return original if can't parse
  };

  // Helper function to format date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // If it's in DD-MM-YYYY format, convert to YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split('-');
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse as date and return in YYYY-MM-DD format
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    
    return dateString; // Return original if can't parse
  };

  // Helper function to check if date is valid
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    
    const formattedDate = formatDateForDisplay(dateString);
    const date = new Date(formattedDate);
    
    return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
  };

  // Helper function to validate if date is in the future
  const isDateInFuture = (dateString) => {
    const formattedDate = formatDateForDisplay(dateString);
    const selectedDate = new Date(formattedDate);
    const today = new Date();
    
    // Set both dates to start of day for accurate comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return selectedDate > today;
  };

  const validateDateRange = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const today = new Date();
    
    // Set dates to midnight for accurate comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (start > end) {
      onToast('Start date cannot be after end date', 'error');
      return false;
    }
    
    // Temporarily allow future dates for testing
    // if (end > today) {
    //   onToast('End date cannot be in the future', 'error');
    //   return false;
    // }
    
    // Calculate inclusive days difference (+1 to include both start and end dates)
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 365) {
      onToast('Date range cannot exceed 365 days', 'error');
      return false;
    }
    
    console.log('📅 Date range validation (INCLUSIVE):', {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      daysDifference: daysDiff,
      isValid: true
    });
    
    return true;
  };


  // Unified data processing function for both UI and export
  const processAttendanceData = (apiStudents, enrolledStudents, totalWorkingDaysCount) => {
    console.log('🔄 Processing attendance data:', { apiStudents, enrolledStudents, totalWorkingDaysCount });
    
    // Create a map of enrolled students for quick lookup
    const enrolledMap = new Map();
    enrolledStudents.forEach(student => {
      enrolledMap.set(student.rollNumber, student);
      if (student.studentId) enrolledMap.set(student.studentId, student);
    });
    
    // Process each student from API response
    const processedStudents = apiStudents.map(apiStudent => {
      console.log('🔍 Processing API student:', apiStudent);
      
      // Find the corresponding enrolled student
      const enrolledStudent = enrolledMap.get(apiStudent.rollNumber) || 
                            enrolledMap.get(apiStudent.studentId) ||
                            enrolledStudents.find(s => 
                              s.name === apiStudent.name || 
                              s.email === apiStudent.email
                            );
      
      // Extract attendance metrics from various possible API structures
      let present = 0, absent = 0, od = 0, holiday = 0;
      
      // Try different possible field names from API
      present = apiStudent.present || apiStudent.presentCount || apiStudent.presentDays || 0;
      absent = apiStudent.absent || apiStudent.absentCount || apiStudent.absentDays || 0;
      od = apiStudent.od || apiStudent.odCount || apiStudent.odDays || apiStudent.onDuty || 0;
      holiday = apiStudent.holiday || apiStudent.holidayCount || apiStudent.holidayDays || 0;
      
      // If direct counts aren't available, try to calculate from records
      if (present === 0 && absent === 0 && od === 0 && holiday === 0 && apiStudent.records) {
        apiStudent.records.forEach(record => {
          switch (record.status?.toLowerCase()) {
            case 'present':
              present++;
              break;
            case 'absent':
              absent++;
              break;
            case 'od':
            case 'onduty':
              od++;
              break;
            case 'holiday':
              holiday++;
              break;
          }
        });
      }
      
      // DEBUG: Log the API student data to understand the structure
      console.log(`🔍 API Student Data for ${apiStudent.name}:`, {
        present: apiStudent.present,
        absent: apiStudent.absent,
        od: apiStudent.od,
        holiday: apiStudent.holiday,
        records: apiStudent.records,
        attendancePercentage: apiStudent.attendancePercentage,
        totalWorkingDays: totalWorkingDaysCount
      });
      
      // PRIORITY 1: Check for explicit absent records marked by faculty
      if (apiStudent.records && apiStudent.records.length > 0) {
        let explicitAbsent = 0;
        apiStudent.records.forEach(record => {
          if (record.status?.toLowerCase() === 'absent') {
            explicitAbsent++;
          }
        });
        if (explicitAbsent > 0) {
          absent = explicitAbsent;
          console.log(`📊 Using explicit absent count from faculty records for ${apiStudent.name}: ${absent}`);
        }
      }
      
      // PRIORITY 2: If no explicit absent records, derive from attendance percentage
      if (absent === 0 && present > 0) {
        // Get the attendance percentage from API or calculate from present/total ratio
        let attendancePercentage = apiStudent.attendancePercentage || 0;
        
        // If no percentage from API, try to calculate from present vs total working days
        if (attendancePercentage === 0 && totalWorkingDaysCount > 0) {
          attendancePercentage = Math.round((present / totalWorkingDaysCount) * 100 * 10) / 10;
        }
        
        // Derive absent days from percentage: (present / (present + absent + od)) * 100 = percentage
        // Solving for absent: absent = (present * 100 / percentage) - present - od
        if (attendancePercentage > 0 && attendancePercentage < 100) {
          const totalConsideredDays = Math.round((present * 100) / attendancePercentage);
          const derivedAbsent = totalConsideredDays - present - od;
          
          if (derivedAbsent > 0) {
            absent = derivedAbsent;
            console.log(`📊 Derived absent from percentage for ${apiStudent.name}: ${absent} (${attendancePercentage}% attendance)`);
          }
        }
      }
      
      // PRIORITY 3: Fallback to API provided absent count
      if (absent === 0 && apiStudent.absent && apiStudent.absent > 0) {
        absent = apiStudent.absent;
        console.log(`📊 Using API absent count for ${apiStudent.name}: ${absent}`);
      }
      
      const totalDays = present + absent + od + holiday;
      
      // Calculate attendance percentage
      // OD is considered as present for percentage calculation
      const presentAndOD = present + od;
      let attendancePercentage = 0;
      if (totalDays > 0) {
        attendancePercentage = Math.round((presentAndOD / (presentAndOD + absent)) * 100 * 10) / 10;
      }
      
      // Final validation: Ensure the calculated values make sense
      if (presentAndOD > 0 && absent > 0) {
        const calculatedPercentage = Math.round((presentAndOD / (presentAndOD + absent)) * 100 * 10) / 10;
        console.log(`📊 Final validation for ${apiStudent.name}: ${present} present, ${od} OD, ${absent} absent, ${calculatedPercentage}% calculated`);
      }
      
      // Recalculate total days and percentage with updated absent
      const finalTotalDays = present + absent + od + holiday;
      const finalAttendancePercentage = finalTotalDays > 0 ? 
        Math.round((presentAndOD / (presentAndOD + absent)) * 100 * 10) / 10 : 0;
      
      console.log('📊 Calculated metrics:', {
        present, absent, od, holiday, totalDays, attendancePercentage
      });
      
      return {
        // Use enrolled student data as primary source for consistency
        rollNumber: enrolledStudent?.rollNumber || apiStudent.rollNumber || '',
        studentId: enrolledStudent?.studentId || apiStudent.studentId || '',
        name: enrolledStudent?.name || apiStudent.name || '',
        email: enrolledStudent?.email || apiStudent.email || '',
        // Attendance metrics (using final calculated values)
        present,
        absent,
        od,
        holiday,
        totalDays: finalTotalDays,
        attendancePercentage: finalAttendancePercentage,
        // Additional data from API
        records: apiStudent.records || [],
        ...apiStudent
      };
    });
    
    // Add enrolled students who don't have attendance records
    enrolledStudents.forEach(enrolledStudent => {
      const hasRecord = processedStudents.some(ps => 
        ps.rollNumber === enrolledStudent.rollNumber ||
        ps.studentId === enrolledStudent.studentId
      );
      
      if (!hasRecord) {
        // Student has no records - they have no attendance data (not marked as absent)
        const present = 0;
        const od = 0;
        const holiday = 0;
        const absent = 0; // No explicit absent records = 0 absent days
        const totalDays = present + absent + od + holiday;
        const attendancePercentage = 0; // Cannot calculate percentage without any records
        
        processedStudents.push({
          rollNumber: enrolledStudent.rollNumber || '',
          studentId: enrolledStudent.studentId || '',
          name: enrolledStudent.name || '',
          email: enrolledStudent.email || '',
          present,
          absent,
          od,
          holiday,
          totalDays,
          attendancePercentage,
          records: []
        });
        
        console.log(`📊 Added student with no records: ${enrolledStudent.name} - no attendance data`);
      }
    });
    
    console.log('✅ Processed students data:', processedStudents);
    return processedStudents;
  };

  const calculateStudentSummaries = (records, enrolledStudents = []) => {
    const studentMap = new Map();
    const workingDays = new Set();
    
    // Initialize all enrolled students first
    enrolledStudents.forEach(enrolledStudent => {
      studentMap.set(enrolledStudent.studentId, {
        studentId: enrolledStudent.studentId,
        rollNumber: enrolledStudent.rollNumber,
        name: enrolledStudent.name,
        email: enrolledStudent.email,
        present: 0,
        absent: 0,
        od: 0,
        holiday: 0,
        totalDays: 0,
        attendancePercentage: 0,
        records: []
      });
    });
    
    // Process each attendance record
    records.forEach(record => {
      workingDays.add(record.date);
      
      if (record.records && Array.isArray(record.records)) {
        record.records.forEach(studentRecord => {
          const studentId = studentRecord.studentId || studentRecord.rollNumber;
          const studentName = studentRecord.studentName || studentRecord.name;
          const email = studentRecord.email;
          
          // Only process students who are enrolled in the class
          if (studentMap.has(studentId)) {
            const student = studentMap.get(studentId);
            student.totalDays++;
            student.records.push({
              date: record.date,
              status: studentRecord.status,
              markedBy: record.createdBy?.name || 'Faculty',
              timestamp: record.createdAt,
              remarks: studentRecord.remarks || ''
            });
            
            switch (studentRecord.status?.toLowerCase()) {
              case 'present':
                student.present++;
                break;
              case 'absent':
                student.absent++;
                break;
              case 'od':
                student.od++;
                break;
              case 'holiday':
                student.holiday++;
                break;
            }
          }
        });
      }
    });
    
    // Calculate percentages (OD is considered as present)
    const totalWorkingDays = workingDays.size;
    const summaries = Array.from(studentMap.values()).map(student => {
      const presentAndOD = student.present + student.od;
      student.attendancePercentage = totalWorkingDays > 0 ? 
        Math.round((presentAndOD / totalWorkingDays) * 100 * 10) / 10 : 0;
      return student;
    });
    
    setStudentSummaries(summaries);
    
    // Calculate summary statistics
    const totalStudents = summaries.length;
    const averageAttendance = totalStudents > 0 ? 
      summaries.reduce((sum, s) => sum + s.attendancePercentage, 0) / totalStudents : 0;
    
    const sortedByAttendance = summaries.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    
    setSummaryStats({
      totalStudents,
      totalWorkingDays,
      averageAttendance: Math.round(averageAttendance * 10) / 10,
      highestAttendance: sortedByAttendance.length > 0 ? {
        name: sortedByAttendance[0].name,
        percentage: sortedByAttendance[0].attendancePercentage
      } : { name: '', percentage: 0 },
      lowestAttendance: sortedByAttendance.length > 0 ? {
        name: sortedByAttendance[sortedByAttendance.length - 1].name,
        percentage: sortedByAttendance[sortedByAttendance.length - 1].attendancePercentage
      } : { name: '', percentage: 0 }
    });
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return '✅';
      case 'absent':
        return '❌';
      case 'od':
        return '🔄';
      case 'holiday':
        return '🏖️';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return 'text-green-600 bg-green-100';
      case 'absent':
        return 'text-red-600 bg-red-100';
      case 'od':
        return 'text-blue-600 bg-blue-100';
      case 'holiday':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getWeekNumber = (dateString) => {
    const date = new Date(dateString);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);
  };

  const groupRecordsByWeek = (records) => {
    const weeks = new Map();
    
    records.forEach(record => {
      const weekNumber = getWeekNumber(record.date);
      const monthYear = new Date(record.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const weekKey = `${monthYear}-Week${weekNumber}`;
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          weekKey,
          monthYear,
          weekNumber,
          startDate: record.date,
          endDate: record.date,
          records: []
        });
      }
      
      const week = weeks.get(weekKey);
      week.records.push(record);
      
      if (record.date < week.startDate) week.startDate = record.date;
      if (record.date > week.endDate) week.endDate = record.date;
    });
    
    return Array.from(weeks.values()).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  };

  const toggleWeekExpansion = (weekKey) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekKey)) {
      newExpanded.delete(weekKey);
    } else {
      newExpanded.add(weekKey);
    }
    setExpandedWeeks(newExpanded);
  };

  const exportToExcel = async () => {
    try {
      const { exportToExcelWithLogo } = await import('../utils/excelExport');
      
      // Prepare data for export
      let exportData = [];
      
      if (viewMode === 'single') {
        students.forEach(student => {
          const found = attendanceHistory.find(
            rec => (rec.rollNo && rec.rollNo === student.rollNumber) ||
                    (rec.rollNumber && rec.rollNumber === student.rollNumber) ||
                    (rec.studentId && rec.studentId === student.studentId)
          );
          const status = found ? (found.status ? found.status.toLowerCase() : 'absent') : 'absent';
          const presentDays = status === 'present' ? 1 : 0;
          const absentDays = status === 'absent' ? 1 : 0;
          const odDays = status === 'od' ? 1 : 0;
          const holidayDays = status === 'holiday' ? 1 : 0;
          const totalDays = 1;
          const attendancePercentage = status === 'present' || status === 'od' ? 100 : 0;
          
          // Determine category
          let category = 'Poor';
          if (attendancePercentage >= 85) category = 'Excellent';
          else if (attendancePercentage >= 75) category = 'Average';
          
          exportData.push({
            'Roll Number': student.rollNumber || '',
            'Student Name': student.name || '',
            'Email': student.email || '',
            'Class': classData ? `${classData.batch}_${classData.year}_${classData.semester}_${classData.section}` : '',
            'Faculty': user?.name || 'Faculty',
            'Total Working Days': totalDays,
            'Days Present': presentDays + odDays,
            'Days Absent': absentDays,
            'OD Days': odDays,
            'Holiday Days': holidayDays,
            'Attendance %': attendancePercentage,
            'Category': category,
            'Status': status.charAt(0).toUpperCase() + status.slice(1)
          });
      });
      } else {
        // For weekly/monthly: use the processed rangeAttendanceData
        rangeAttendanceData.forEach((student) => {
          const presentDays = student.present || 0;
          const absentDays = student.absent || 0;
          const odDays = student.od || 0;
          const holidayDays = student.holiday || 0;
          const totalDays = student.totalDays || 0;
          const attendancePercentage = student.attendancePercentage || 0;
          
          // Determine category
          let category = 'Poor';
          if (attendancePercentage >= 85) category = 'Excellent';
          else if (attendancePercentage >= 75) category = 'Average';
          
          exportData.push({
            'Roll Number': student.rollNumber || '',
            'Student Name': student.name || '',
            'Email': student.email || '',
            'Class': classData ? `${classData.batch}_${classData.year}_${classData.semester}_${classData.section}` : '',
            'Faculty': user?.name || 'Faculty',
            'Total Working Days': totalDays,
            'Days Present': presentDays + odDays,
            'Days Absent': absentDays,
            'OD Days': odDays,
            'Holiday Days': holidayDays,
            'Attendance %': attendancePercentage,
            'Category': category
          });
        });
      }
      
      // Prepare date range string
      let dateRangeStr = '';
      if (viewMode === 'single' && singleDate) {
        const date = new Date(singleDate);
        dateRangeStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } else if ((viewMode === 'weekly' || viewMode === 'monthly') && dateRange.startDate && dateRange.endDate) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        dateRangeStr = `${start.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} to ${end.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
      }
      
      // Calculate summary statistics
      const totalStudents = exportData.length;
      const totalPresent = exportData.reduce((sum, s) => sum + (s['Days Present'] || 0), 0);
      const totalAbsent = exportData.reduce((sum, s) => sum + (s['Days Absent'] || 0), 0);
      const avgAttendance = exportData.length > 0 
        ? exportData.reduce((sum, s) => sum + (s['Attendance %'] || 0), 0) / exportData.length 
        : 0;
      
      let overallStatus = 'Poor';
      if (avgAttendance >= 85) overallStatus = 'Excellent';
      else if (avgAttendance >= 75) overallStatus = 'Average';
      
      // Export to Excel
      await exportToExcelWithLogo(
        exportData,
        'Attendance_History',
        'Attendance History',
        {
          reportTitle: 'Student Attendance Report',
          department: user?.department || classData?.department || '',
          batch: classData?.batch || '',
          year: classData?.year || '',
          semester: classData?.semester || '',
          section: classData?.section || '',
          dateRange: dateRangeStr,
          facultyName: user?.name || 'Faculty',
          summary: {
            totalStudents,
            totalPresent,
            totalAbsent,
            averageAttendance: Math.round(avgAttendance * 10) / 10,
            overallStatus
          }
        }
      );
      
      onToast('Excel file downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      onToast('Error exporting Excel file', 'error');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Attendance History</h2>
          <p className="text-sm text-gray-500">Loading attendance records...</p>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls - Mobile Responsive */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-medium text-gray-900">Attendance History</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">View, filter, and analyze attendance records with real-time sync</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoRefresh" className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Auto-refresh</label>
              </div>
              <button
                onClick={fetchAttendanceHistory}
                disabled={loading}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={exportToExcel}
                disabled={false}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          </div>
          {autoRefresh && (
            <div className="mt-2 text-xs text-gray-500">
              Last refreshed: {lastRefresh.toLocaleTimeString()} | Auto-refreshing every 30 seconds
            </div>
          )}
        </div>
        
        <div className="p-4 sm:p-6">
          {/* Filter Controls - Mobile Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">View Mode</label>
                <select
                  value={viewMode}
                  onChange={(e) => handleViewModeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="single">Single Date</option>
                  <option value="weekly">Date Range (Weekly)</option>
                  <option value="monthly">Date Range (Monthly)</option>
                </select>
            </div>
            
            {viewMode === 'single' ? (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <input
                  type="date"
                  value={formatDateForDisplay(singleDate)}
                  onChange={(e) => {
                    const formattedValue = formatDateForDisplay(e.target.value);
                    setSingleDate(formattedValue);
                    // Clear any existing errors when user changes date
                    if (error) {
                      setError(null);
                    }
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 text-sm sm:text-base border rounded-md focus:outline-none focus:ring-2 ${
                    !isValidDate(singleDate) || isDateInFuture(singleDate)
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {(!isValidDate(singleDate) || isDateInFuture(singleDate)) && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600">
                    {!isValidDate(singleDate) 
                      ? 'Please select a valid date' 
                      : 'Cannot view attendance for future dates'
                    }
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    {viewMode === 'weekly' ? 'Week Start Date' : 'Month Start Date'}
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {viewMode === 'weekly' && (
                    <p className="text-xs text-gray-500 mt-1">Auto-set to 7 days ago</p>
                  )}
                  {viewMode === 'monthly' && (
                    <p className="text-xs text-gray-500 mt-1">Auto-set to 1st of month</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    {viewMode === 'weekly' ? 'Week End Date' : 'Month End Date'}
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-set to today</p>
                </div>
              </>
            )}
            
            <div className="flex items-end sm:items-center">
              <button
                onClick={fetchAttendanceHistory}
                disabled={loading || (viewMode === 'single' && (!isValidDate(singleDate) || isDateInFuture(singleDate)))}
                className={`w-full px-4 py-2.5 sm:py-2 text-sm sm:text-base rounded-md flex items-center justify-center gap-2 ${
                  loading || (viewMode === 'single' && (!isValidDate(singleDate) || isDateInFuture(singleDate)))
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>View History</span>
              </button>
            </div>
          </div>

          {/* Summary Cards - Mobile Responsive */}
          {(viewMode === 'single' ? attendanceHistory.length > 0 : rangeAttendanceData.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-blue-900">Total Students</h3>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{summaryStats.totalStudents}</p>
              </div>
              <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-green-900">
                  {viewMode === 'single' ? 'Present (incl. OD)' : 'Working Days'}
                </h3>
                <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">
                  {viewMode === 'single' ? 
                    (attendanceHistory.filter(r => {
                      const status = r.status?.toLowerCase() || '';
                      return status === 'present' || status === 'od';
                    }).length) : 
                    summaryStats.totalWorkingDays
                  }
                </p>
              </div>
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-blue-900">
                  {viewMode === 'single' ? 'OD Today' : 'Avg Attendance'}
                </h3>
                <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">
                  {viewMode === 'single' ? 
                    (attendanceHistory.filter(r => {
                      const status = r.status?.toLowerCase() || '';
                      return status === 'od' || status === 'onduty';
                    }).length) : 
                    `${summaryStats.averageAttendance}%`
                  }
                </p>
              </div>
              <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-purple-900">
                  {viewMode === 'single' ? 'Absent Today' : 'Highest'}
                </h3>
                <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">
                  {viewMode === 'single' ? 
                    (attendanceHistory.filter(r => {
                      const status = r.status?.toLowerCase() || '';
                      return status === 'absent';
                    }).length) : 
                    summaryStats.highestAttendance.name || '-'
                  }
                </p>
              </div>
              <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-yellow-900">
                  {viewMode === 'single' ? 'Attendance %' : 'Highest'}
                </h3>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600 mt-1">
                  {viewMode === 'single' ? 
                    (attendanceHistory.length > 0 
                      ? `${Math.round((attendanceHistory.filter(r => {
                          const status = r.status?.toLowerCase() || '';
                          return status === 'present' || status === 'od';
                        }).length / attendanceHistory.length) * 100)}%`
                      : '0%') : 
                    summaryStats.highestAttendance.name || '-'
                  }
                </p>
                {viewMode !== 'single' && (
                  <p className="text-xs sm:text-sm text-yellow-700 mt-1">{summaryStats.highestAttendance.percentage}%</p>
                )}
              </div>
              <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-xs sm:text-sm font-medium text-red-900">
                  {viewMode === 'single' ? 'Status' : 'Lowest'}
                </h3>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mt-1">
                  {viewMode === 'single' ? 
                    (() => {
                      const presentAndOD = attendanceHistory.filter(r => {
                        const status = r.status?.toLowerCase() || '';
                        return status === 'present' || status === 'od';
                      }).length;
                      const percentage = attendanceHistory.length > 0 ? (presentAndOD / attendanceHistory.length) * 100 : 0;
                      return percentage >= 75 ? 'Good' : percentage >= 50 ? 'Average' : 'Poor';
                    })() :
                    summaryStats.lowestAttendance.name || '-'
                  }
                </p>
                {viewMode !== 'single' && (
                  <p className="text-xs sm:text-sm text-red-700 mt-1">{summaryStats.lowestAttendance.percentage}%</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Table Content */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {viewMode === 'single' ? 'Single Date View' : 
             viewMode === 'weekly' ? 'Weekly View' : 'Monthly View'}
          </h3>
          <p className="text-sm text-gray-500">
            {viewMode === 'single' ? `Attendance records for ${formatDate(singleDate)}` :
             viewMode === 'weekly' ? `Weekly attendance summary from ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}` :
             `Monthly attendance summary from ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`}
          </p>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Attendance Records...</h3>
              <p className="text-gray-500">Please wait while we fetch the data</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={fetchAttendanceHistory}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : (viewMode === 'single' ? attendanceHistory.length === 0 : rangeAttendanceData.length === 0) ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h3>
              <p className="text-gray-500 mb-4">
                No attendance records found for the selected {viewMode === 'single' ? 'date' : 'date range'}.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Possible reasons:</h4>
                <ul className="text-sm text-blue-800 text-left space-y-1">
                  <li>• No attendance has been marked for this {viewMode === 'single' ? 'date' : 'period'}</li>
                  <li>• The date range is too narrow</li>
                  <li>• Attendance records are not available for this class</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {viewMode === 'single' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marked By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceHistory.map((record) => (
                        <tr key={record.rollNo} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {record.rollNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                              {getStatusIcon(record.status)} {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs">
                              {record.remarks && record.remarks !== '-' ? (
                                <div>
                                  <p className="text-gray-900">{record.remarks}</p>
                                  {/* Only show reviewStatus if it's not "Not Applicable" and status is not "OD" */}
                                  {record.reviewStatus && 
                                   record.reviewStatus !== 'Not Applicable' && 
                                   record.status !== 'OD' && 
                                   record.status !== 'od' && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                                      record.reviewStatus === 'Reviewed' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {record.reviewStatus}
                                    </span>
                                  )}
                                  {record.facultyNote && (
                                    <p className="text-xs text-gray-600 mt-1 italic">
                                      Faculty: {record.facultyNote}
                                    </p>
                                  )}
                                </div>
                              ) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.markedBy || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.timestamp && record.timestamp !== '-' ? new Date(record.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(viewMode === 'weekly' || viewMode === 'monthly') && (
                <div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        {workingDays.map((date) => (
                          <th key={date} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {new Date(date).toLocaleDateString('en-IN', { 
                              day: '2-digit', 
                              month: 'short' 
                            })}
                          </th>
                        ))}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Present Count</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Working Days</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rangeAttendanceData && rangeAttendanceData.length > 0 ? rangeAttendanceData.map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {student.rollNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.email}
                          </td>
                          {workingDays.map((date) => {
                            const status = student.attendanceData[date] || 'Not Marked';
                            return (
                              <td key={date} className="px-2 py-4 text-center text-sm">
                                <span className={`inline-flex px-1 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                                  {getStatusIcon(status)}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-center text-sm text-gray-900 font-semibold">
                            {student.presentCount}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900 font-semibold">
                            {student.totalWorkingDays}
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            <span className={`font-semibold ${student.attendancePercentage >= 75 ? 'text-green-600' : student.attendancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {student.attendancePercentage}%
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={workingDays.length + 6} className="px-6 py-8 text-center text-gray-500">
                            No student data available for the selected date range
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
              )}

              {/* Monthly view is now handled by the weekly/monthly combined view above */}
              {false && viewMode === 'monthly' && (
                <div className="space-y-4">
                  {groupRecordsByWeek(attendanceHistory).map((week) => (
                    <div key={week.weekKey} className="border border-gray-200 rounded-lg">
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleWeekExpansion(week.weekKey)}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-medium text-gray-900">
                            {week.monthYear} - Week {week.weekNumber}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatDate(week.startDate)} - {formatDate(week.endDate)}</span>
                            <span>{week.records.length} days</span>
                            <svg 
                              className={`w-5 h-5 transition-transform ${expandedWeeks.has(week.weekKey) ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {expandedWeeks.has(week.weekKey) && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OD</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Attendance</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {studentSummaries.map((student) => {
                                  const weekRecords = student.records.filter(r => 
                                    week.records.some(wr => wr.date === r.date)
                                  );
                                  const weekPresent = weekRecords.filter(r => r.status === 'present').length;
                                  const weekAbsent = weekRecords.filter(r => r.status === 'absent').length;
                                  const weekOD = weekRecords.filter(r => r.status === 'od').length;
                                  const weekHoliday = weekRecords.filter(r => r.status === 'holiday').length;
                                  const weekPercentage = weekRecords.length > 0 ? 
                                    Math.round((weekPresent / weekRecords.length) * 100 * 10) / 10 : 0;
                                  
                                  return (
                                    <tr key={student.studentId} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {student.rollNumber}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {student.name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                        {weekPresent}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                        {weekAbsent}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                                        {weekOD}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-medium">
                                        {weekHoliday}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                        {weekPercentage}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Student Management Tab Component
const StudentManagementTab = ({ classData, students, onToast, onStudentsUpdate, user, navigate }) => {
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  // Debug classData
  useEffect(() => {
    console.log('🔍 StudentManagementTab - classData:', classData);
  }, [classData]);

  const handleAddStudent = async (studentData) => {
    try {
      setLoading(true);
      
      // Prepare data with correct format
      const studentPayload = {
        ...studentData,
        batch: classData.batch,
        year: classData.year,
        semester: classData.semester.startsWith('Sem') ? classData.semester : `Sem ${classData.semester}`, // Ensure proper format
        section: classData.section,
        department: user.department // Use user.department instead of classData.department
      };

      console.log('🔍 Adding student with data:', studentPayload);
      console.log('🔍 User department:', user.department);
      console.log('🔍 Class data:', classData);
      console.log('🔍 Semester processing in handleAddStudent:', {
        classDataSemester: classData.semester,
        startsWithSem: classData.semester.startsWith('Sem'),
        finalSemester: classData.semester.startsWith('Sem') ? classData.semester : `Sem ${classData.semester}`
      });

      const response = await apiFetch({
        url: '/api/students',
        method: 'POST',
        data: studentPayload
      });

      if (response.data.success) {
        onToast('Student added successfully!', 'success');
        setShowAddStudent(false);
        // Refresh students list using new classId-based API
        const studentsResponse = await apiFetch({
          url: `/api/classes/${classId}/students`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
        }
      } else {
        onToast(response.data.message || 'Failed to add student', 'error');
      }
    } catch (error) {
      console.error('Error adding student:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error adding student';
      if (error.response?.status === 400) {
        // Handle validation errors
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          const validationErrors = error.response.data.errors.map(err => err.msg).join(', ');
          errorMessage = `Validation failed: ${validationErrors}`;
        } else if (error.response.data.message) {
          errorMessage = `Validation failed: ${error.response.data.message}`;
        } else {
          errorMessage = 'Validation failed: Please check all required fields';
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Unauthorized: You do not have permission to add students. Please contact your administrator.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Forbidden: You are not authorized to add students to this class.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      onToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = async (studentId, studentData) => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: `/api/students/${studentId}`,
        method: 'PUT',
        data: studentData
      });

      if (response.data.success) {
        onToast('Student updated successfully!', 'success');
        setEditingStudent(null);
        // Refresh students list using new classId-based API
        const studentsResponse = await apiFetch({
          url: `/api/classes/${classId}/students`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
        }
      } else {
        onToast(response.data.message || 'Failed to update student', 'error');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      onToast('Error updating student', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm(`Are you sure you want to remove this student from ${classData.semester}? They will remain enrolled in other semesters.`)) return;

    try {
      setLoading(true);
      
      // Prepare semester context for deletion
      const semesterContext = {
        semesterName: classData.semester,
        year: classData.year,
        section: classData.section || 'A',
        department: user.department
      };
      
      console.log('🗑️ Deleting student from semester:', semesterContext);
      
      const response = await apiFetch({
        url: `/api/students/${studentId}/semester`,
        method: 'DELETE',
        data: semesterContext
      });

      if (response.data.success) {
        const message = response.data.data?.semesterRemoved 
          ? `Student removed from ${classData.semester} successfully! They remain enrolled in other semesters.`
          : 'Student removed from semester successfully!';
        onToast(message, 'success');
        
        // Refresh students list using new classId-based API
        const studentsResponse = await apiFetch({
          url: `/api/classes/${classId}/students`,
          method: 'GET'
        });
        if (studentsResponse.data.success) {
          onStudentsUpdate(studentsResponse.data.data.students || []);
        }
      } else {
        onToast(response.data.message || 'Failed to delete student', 'error');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      onToast('Error deleting student', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = () => {
    setShowBulkUpload(true);
  };

  const closeBulkUpload = () => {
    setShowBulkUpload(false);
  };

  const handleStudentsAdded = async () => {
    // Refresh the students list after bulk upload using new classId-based API
    try {
      const studentsResponse = await apiFetch({
        url: `/api/classes/${classId}/students`,
        method: 'GET'
      });
      if (studentsResponse.data.success) {
        onStudentsUpdate(studentsResponse.data.data.students || []);
        onToast('Students list refreshed successfully!', 'success');
      }
    } catch (error) {
      console.error('Error refreshing students list:', error);
      onToast('Error refreshing students list', 'error');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-medium text-gray-900">Student Management</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage students in this class</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={handleBulkUpload}
              className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 text-sm sm:text-base rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Bulk Upload</span>
            </button>
            <button
              onClick={() => setShowAddStudent(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 text-sm sm:text-base rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Student</span>
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {(students || []).length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl sm:text-6xl mb-4">👥</div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Students Found</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-4">No students are enrolled in this class yet.</p>
            <button
              onClick={() => setShowAddStudent(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 text-sm sm:text-base rounded-md hover:bg-blue-700"
            >
              Add First Student
            </button>
            </div>
          ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Contact</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(students || []).map((student) => (
                    <tr key={student._id || student.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {student.rollNumber}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const studentId = student._id || student.id;
                            navigate(`/student-detail/${studentId}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {student.name}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 break-all">
                        {student.email}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.mobile || 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.parentContact || 'N/A'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student._id || student.id)}
                            className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {(students || []).map((student) => (
                <div key={student._id || student.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-medium text-gray-500">Roll Number:</p>
                          <p className="text-sm font-semibold text-gray-900">{student.rollNumber}</p>
                        </div>
                        <div className="mb-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const studentId = student._id || student.id;
                              navigate(`/student-detail/${studentId}`);
                            }}
                            className="text-sm sm:text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {student.name}
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <p className="text-xs font-medium text-gray-500 min-w-[80px]">Email:</p>
                            <p className="text-xs sm:text-sm text-gray-600 break-all flex-1">{student.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-gray-500 min-w-[80px]">Mobile:</p>
                            <p className="text-xs sm:text-sm text-gray-600">{student.mobile || 'N/A'}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <p className="text-xs font-medium text-gray-500 min-w-[80px]">Parent:</p>
                            <p className="text-xs sm:text-sm text-gray-600 break-all flex-1">{student.parentContact || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700">Actions:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="flex-1 px-3 py-2 text-xs sm:text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student._id || student.id)}
                          className="flex-1 px-3 py-2 text-xs sm:text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (
        <AddStudentModal
          onClose={() => setShowAddStudent(false)}
          onAdd={handleAddStudent}
          loading={loading}
          classData={classData}
        />
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={handleEditStudent}
          loading={loading}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={closeBulkUpload}
          onStudentsAdded={handleStudentsAdded}
          classInfo={{ 
            batch: classData.batch, 
            year: classData.year, 
            semester: classData.semester, 
            section: classData.section || 'A', 
            department: user.department 
          }}
        />
      )}
    </div>
  );
};

// Add Student Modal Component
const AddStudentModal = ({ onClose, onAdd, loading, classData }) => {
  const [formData, setFormData] = useState({
    rollNumber: '',
    name: '',
    email: '',
    mobile: '',
    parentContact: '',
    password: '',
    // Default values from class context
    batch: classData?.batch || '',
    year: classData?.year || '',
    semester: classData?.semester || '',
    section: classData?.section || '',
    department: classData?.department || ''
  });

  // Update form data when classData changes
  useEffect(() => {
    console.log('🔍 AddStudentModal - classData received:', classData);
    if (classData) {
      setFormData(prev => ({
        ...prev,
        batch: classData.batch || '',
        year: classData.year || '',
        semester: classData.semester || '',
        section: classData.section || '',
        department: classData.department || ''
      }));
      console.log('✅ AddStudentModal - formData updated with class info:', {
        batch: classData.batch,
        year: classData.year,
        semester: classData.semester,
        section: classData.section
      });
    }
  }, [classData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start sm:items-center justify-center p-4">
      <div className="relative w-full max-w-md shadow-lg rounded-md bg-white mt-4 sm:mt-0">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Add New Student</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {/* Class Information (Read-only) */}
            <div className="bg-blue-50 p-3 rounded-md">
              <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">Class Information</h4>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-blue-700">Batch:</span>
                  <span className="ml-1 font-medium break-words">{formData.batch || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Year:</span>
                  <span className="ml-1 font-medium">{formData.year || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Semester:</span>
                  <span className="ml-1 font-medium break-words">{formData.semester || 'Loading...'}</span>
                </div>
                <div>
                  <span className="text-blue-700">Section:</span>
                  <span className="ml-1 font-medium">{formData.section || 'Loading...'}</span>
                </div>
              </div>
              {!formData.batch && (
                <p className="text-xs text-blue-600 mt-2">
                  Class information will be loaded automatically from the selected class.
                </p>
              )}
            </div>

            {/* Student Information */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                placeholder="e.g., STU001, CS2024001"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter student's full name"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="student@example.com"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Student Mobile *</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                pattern="[0-9]{10}"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent's Contact *</label>
              <input
                type="tel"
                name="parentContact"
                value={formData.parentContact}
                onChange={handleChange}
                placeholder="Parent's mobile number"
                pattern="[0-9]{10}"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                minLength="6"
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Adding...' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Student Modal Component
const EditStudentModal = ({ student, onClose, onSave, loading }) => {
  const [formData, setFormData] = useState({
    rollNumber: student.rollNumber || '',
    name: student.name || '',
    email: student.email || '',
    mobile: student.mobile || '',
    parentContact: student.parentContact || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(student._id || student.id, formData);
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start sm:items-center justify-center p-4">
      <div className="relative w-full max-w-md shadow-lg rounded-md bg-white mt-4 sm:mt-0">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">Edit Student</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Roll Number</label>
              <input
                type="text"
                name="rollNumber"
                value={formData.rollNumber}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Mobile</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Parent Contact</label>
              <input
                type="tel"
                name="parentContact"
                value={formData.parentContact}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClassAttendanceManagement;
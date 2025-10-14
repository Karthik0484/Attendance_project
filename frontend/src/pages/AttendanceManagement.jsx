/**
 * Attendance Management Page
 * Main page for faculty to mark, edit, and view attendance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClassContext } from '../context/ClassContext';
import { apiFetch } from '../utils/apiFetch';
import AttendanceMarking from '../components/AttendanceMarking';
import AttendanceHistory from '../components/AttendanceHistory';
import AttendanceReports from '../components/AttendanceReports';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';

const AttendanceManagement = () => {
  const navigate = useNavigate();
  const { activeClass, getClassInfo } = useClassContext();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('mark');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);

  // Load class information and students
  const loadClassData = useCallback(async () => {
    if (!activeClass) {
      setToast({
        show: true,
        message: 'No class selected. Please select a class first.',
        type: 'warning'
      });
      navigate('/class-management');
      return;
    }

    setLoading(true);
    try {
      const classData = getClassInfo();
      setClassInfo(classData);

      // Load students for this class
      const studentsResponse = await apiFetch({
        url: `/api/attendance-management/students?classId=${encodeURIComponent(classData.classId)}`,
        method: 'GET'
      });

      if (studentsResponse.data.success) {
        setStudents(studentsResponse.data.data.students);
        console.log('✅ Students loaded:', studentsResponse.data.data.students.length);
      } else {
        console.error('❌ Failed to load students:', studentsResponse.data.message);
        setToast({
          show: true,
          message: 'Failed to load students for this class',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error loading class data:', error);
      setToast({
        show: true,
        message: 'Error loading class data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [activeClass, getClassInfo, navigate]);

  useEffect(() => {
    loadClassData();
  }, [loadClassData]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'info' });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!classInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Class Selected</h2>
          <p className="text-gray-600 mb-6">Please select a class to manage attendance</p>
          <button
            onClick={() => navigate('/class-management')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Select Class
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
              <p className="text-gray-600 mt-1">
                {classInfo.batch} - {classInfo.year} - {classInfo.semester} - Section {classInfo.section}
              </p>
            </div>
            <button
              onClick={() => navigate('/class-management')}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Classes
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => handleTabChange('mark')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mark'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mark Attendance
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Attendance History
            </button>
            <button
              onClick={() => handleTabChange('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reports
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'mark' && (
          <AttendanceMarking
            classInfo={classInfo}
            students={students}
            onSuccess={showToast}
            onError={showToast}
          />
        )}
        {activeTab === 'history' && (
          <AttendanceHistory
            classInfo={classInfo}
            onError={showToast}
          />
        )}
        {activeTab === 'reports' && (
          <AttendanceReports
            classInfo={classInfo}
            onError={showToast}
          />
        )}
      </div>

      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </div>
  );
};

export default AttendanceManagement;

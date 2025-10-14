/**
 * Attendance Marking Component
 * Allows faculty to mark attendance for their class
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import LoadingSpinner from './LoadingSpinner';

const AttendanceMarking = ({ classInfo, students, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAbsentStudents, setSelectedAbsentStudents] = useState([]);
  const [notes, setNotes] = useState('');
  const [existingAttendance, setExistingAttendance] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [today, setToday] = useState('');

  // Initialize today's date
  useEffect(() => {
    const todayDate = new Date();
    const todayStr = todayDate.toISOString().split('T')[0];
    setToday(todayStr);
  }, []);

  // Check for existing attendance
  useEffect(() => {
    if (classInfo && today) {
      checkExistingAttendance();
    }
  }, [classInfo, today]);

  const checkExistingAttendance = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/attendance-management/check?classId=${encodeURIComponent(classInfo.classId)}&date=${today}`,
        method: 'GET'
      });

      if (response.data.success) {
        const { exists, canEdit: editAllowed, attendance } = response.data.data;
        setExistingAttendance(attendance);
        setCanEdit(editAllowed);

        if (exists && attendance) {
          setSelectedAbsentStudents(attendance.absentStudents || []);
          setNotes(attendance.notes || '');
        }
      }
    } catch (error) {
      console.error('Error checking existing attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (rollNumber) => {
    setSelectedAbsentStudents(prev => {
      if (prev.includes(rollNumber)) {
        return prev.filter(rn => rn !== rollNumber);
      } else {
        return [...prev, rollNumber];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedAbsentStudents.length === students.length) {
      setSelectedAbsentStudents([]);
    } else {
      setSelectedAbsentStudents(students.map(s => s.rollNumber));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!classInfo || !today) {
      onError('Invalid class or date information');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch({
        url: '/api/attendance-management/mark',
        method: 'POST',
        body: {
          classId: classInfo.classId,
          date: today,
          absentStudents: selectedAbsentStudents,
          notes: notes.trim()
        }
      });

      if (response.data.success) {
        const message = existingAttendance ? 'Attendance updated successfully!' : 'Attendance marked successfully!';
        onSuccess(message);
        
        // Refresh the existing attendance data
        await checkExistingAttendance();
      } else {
        onError(response.data.message || 'Failed to mark attendance');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      onError('Error marking attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const presentStudents = students.filter(student => 
    !selectedAbsentStudents.includes(student.rollNumber)
  );

  const absentStudents = students.filter(student => 
    selectedAbsentStudents.includes(student.rollNumber)
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {existingAttendance ? 'Edit Attendance' : 'Mark Attendance'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Date: {today} {existingAttendance && canEdit && '(Editable)'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">
              Total Students: {students.length}
            </div>
            <div className="text-sm text-gray-600">
              Present: {presentStudents.length} | Absent: {absentStudents.length}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {/* Quick Actions */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              {selectedAbsentStudents.length === students.length ? 'Select None' : 'Select All as Absent'}
            </button>
            <div className="text-sm text-gray-600">
              Click on students to mark them as absent
            </div>
          </div>
        </div>

        {/* Students List */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => {
              const isAbsent = selectedAbsentStudents.includes(student.rollNumber);
              return (
                <div
                  key={student.rollNumber}
                  onClick={() => handleStudentToggle(student.rollNumber)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    isAbsent
                      ? 'border-red-200 bg-red-50'
                      : 'border-green-200 bg-green-50 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {student.rollNumber}
                      </div>
                      <div className="text-sm text-gray-600">
                        {student.name}
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full ${
                      isAbsent ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any notes about today's attendance..."
          />
        </div>

        {/* Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Attendance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Students</div>
              <div className="font-semibold text-gray-900">{students.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Present</div>
              <div className="font-semibold text-green-600">{presentStudents.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Absent</div>
              <div className="font-semibold text-red-600">{absentStudents.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Attendance %</div>
              <div className="font-semibold text-gray-900">
                {students.length > 0 ? Math.round((presentStudents.length / students.length) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              setSelectedAbsentStudents([]);
              setNotes('');
            }}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {existingAttendance ? 'Updating...' : 'Marking...'}
              </div>
            ) : (
              existingAttendance ? 'Update Attendance' : 'Mark Attendance'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AttendanceMarking;

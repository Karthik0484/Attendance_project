import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';
import ClassAssignmentModal from './ClassAssignmentModal';

const FacultyCard = ({ faculty, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [assignments, setAssignments] = useState(faculty.assignedClasses || []);
  const [loading, setLoading] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState(null);

  // Update assignments when faculty data changes (fixes initial load issue)
  useEffect(() => {
    if (faculty.assignedClasses !== undefined) {
      console.log('📊 Updating assignments for faculty:', faculty.name, 'Count:', faculty.assignedClasses.length);
      setAssignments(faculty.assignedClasses);
    }
  }, [faculty.assignedClasses, faculty.name]);

  // Fetch detailed assignments when card is expanded
  useEffect(() => {
    if (expanded && faculty._id) {
      fetchAssignments();
    }
  }, [expanded, faculty._id]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/faculty/${faculty._id}/assignments`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        // Use classAssignments if available, otherwise fall back to assignments
        const assignments = response.data.data.classAssignments || response.data.data.assignments || [];
        console.log('📋 Faculty assignments loaded:', {
          facultyId: faculty._id,
          classAssignments: response.data.data.classAssignments?.length || 0,
          assignments: response.data.data.assignments?.length || 0,
          total: assignments.length
        });
        setAssignments(assignments);
      } else {
        setToast({ show: true, message: 'Failed to load assignments', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setToast({ show: true, message: 'Error loading assignments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignmentClick = (assignment) => {
    setAssignmentToRemove(assignment);
    setShowRemoveConfirm(true);
  };

  const handleRemoveConfirm = async () => {
    if (!assignmentToRemove) return;

    setShowRemoveConfirm(false);
    setLoading(true);

    console.log('🗑️ Removing assignment:', {
      assignmentId: assignmentToRemove._id,
      facultyId: faculty._id,
      assignment: assignmentToRemove
    });

    try {
      const response = await apiFetch({
        url: `/api/class-assignment/${assignmentToRemove._id}`,
        method: 'DELETE'
      });

      if (response.data.status === 'success') {
        setToast({ show: true, message: 'Class assignment removed successfully', type: 'success' });
        fetchAssignments(); // Refresh assignments
        onUpdate(); // Notify parent to refresh faculty list
      } else {
        setToast({ show: true, message: response.data.message || 'Failed to remove assignment', type: 'error' });
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to remove assignment';
      setToast({ show: true, message: `Error: ${errorMessage}`, type: 'error' });
    } finally {
      setLoading(false);
      setAssignmentToRemove(null);
    }
  };

  const handleRemoveCancel = () => {
    setShowRemoveConfirm(false);
    setAssignmentToRemove(null);
  };

  const handleAssignmentUpdated = () => {
    fetchAssignments();
    onUpdate();
  };

  const getStatusColor = (activeCount, totalCount) => {
    if (totalCount === 0) return 'bg-red-100 text-red-800';
    if (activeCount === 0) return 'bg-gray-100 text-gray-600';
    if (activeCount === 1 && totalCount === 1) return 'bg-green-100 text-green-800';
    if (activeCount >= 1) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (activeCount, totalCount) => {
    if (totalCount === 0) return 'Unassigned';
    if (activeCount === 0) return `${totalCount} Archived`;
    if (activeCount === 1 && totalCount === 1) return 'Active Class Advisor';
    if (activeCount === totalCount) return `${activeCount} Active Classes`;
    return `${activeCount} Active, ${totalCount - activeCount} Archived`;
  };

  const getActiveCount = () => {
    return assignments.filter(a => a.status === 'Active' || a.isActive).length;
  };

  const formatClassDisplay = (assignment) => {
    return `${assignment.batch} | ${assignment.year} | Sem ${assignment.semester} | Section ${assignment.section}`;
  };

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 w-full overflow-hidden">
        {/* Faculty Header */}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 w-full">
              {/* Name and Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">{faculty.name}</h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm font-medium w-fit ${getStatusColor(getActiveCount(), assignments.length)}`}>
                  {getStatusText(getActiveCount(), assignments.length)}
                </span>
              </div>
              
              {/* Faculty Details - Vertical Stack on Mobile */}
              <div className="flex flex-col space-y-1 text-sm text-gray-600 mb-3">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="font-medium text-gray-700">Position:</span>
                  <span className="sm:ml-2">{faculty.position}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="text-blue-600 break-all sm:ml-2">{faculty.email}</span>
                </div>
                {faculty.phone && (
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="sm:ml-2">{faculty.phone}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="font-medium text-gray-700">Department:</span>
                  <span className="sm:ml-2">{faculty.department}</span>
                </div>
              </div>

              {/* Class Statistics - Vertical Stack on Mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="font-medium mr-2">Total Classes:</span>
                  <span className="font-semibold text-blue-600">{assignments.length}</span>
                </div>
                {assignments.length > 0 && (
                  <>
                    <div className="flex items-center">
                      <span className="font-medium mr-2">Active:</span>
                      <span className="font-semibold text-green-600">{getActiveCount()}</span>
                    </div>
                    {assignments.length - getActiveCount() > 0 && (
                      <div className="flex items-center">
                        <span className="font-medium mr-2">Archived:</span>
                        <span className="font-semibold text-gray-500">{assignments.length - getActiveCount()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons - Stack Vertically on Mobile */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:ml-4 w-full sm:w-auto">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
              >
                {expanded ? 'Hide Details' : 'View Assignments'}
              </button>
              <button
                onClick={() => setShowAssignmentModal(true)}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
              >
                Assign Class
              </button>
              <button
                onClick={() => onDelete(faculty._id, faculty.name)}
                disabled={loading}
                className={`w-full sm:w-auto px-4 py-2 text-sm sm:text-base rounded-lg transition-colors font-medium ${
                  loading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {loading ? 'Deleting...' : 'Delete Faculty'}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Class Assignments */}
        {expanded && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="p-4 sm:p-6">
              <h4 className="text-base sm:text-md font-semibold text-gray-900 mb-4">Assigned Classes</h4>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm sm:text-base text-gray-600">Loading assignments...</span>
                </div>
              ) : assignments.length > 0 ? (
                <div className="space-y-3">
                  {assignments.map((assignment) => {
                    const isActive = assignment.status === 'Active' || assignment.isActive;
                    const statusColor = isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600';
                    const statusIcon = isActive ? '✓' : '📦';
                    
                    return (
                      <div
                        key={assignment._id}
                        className={`rounded-lg border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                          isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                            <span className={`text-sm sm:text-base font-medium break-words ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                              {formatClassDisplay(assignment)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${statusColor}`}>
                              {statusIcon} {assignment.status || (isActive ? 'Active' : 'Inactive')}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 space-y-0.5">
                            <div>Assigned on {new Date(assignment.assignedDate).toLocaleDateString()}</div>
                            {!isActive && assignment.deactivatedDate && (
                              <div className="text-red-600">
                                Deactivated on {new Date(assignment.deactivatedDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-start sm:justify-end">
                          {isActive && (
                            <button
                              onClick={() => handleRemoveAssignmentClick(assignment)}
                              className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                            >
                              Remove
                            </button>
                          )}
                          {!isActive && (
                            <span className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed text-center">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm sm:text-base text-gray-500 mb-4">No class assignments found</div>
                  <button
                    onClick={() => setShowAssignmentModal(true)}
                    className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Assign First Class
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Class Assignment Modal */}
      {showAssignmentModal && (
        <ClassAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          faculty={faculty}
          onAssignmentUpdated={handleAssignmentUpdated}
        />
      )}

      {/* Remove Assignment Confirmation Modal */}
      {showRemoveConfirm && assignmentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Remove Class Assignment</h3>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Are you sure you want to remove the class assignment for{' '}
                <span className="font-semibold text-gray-900">
                  {assignmentToRemove.batch} | {assignmentToRemove.year} | Sem {assignmentToRemove.semester} | Section {assignmentToRemove.section}
                </span>?
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRemoveCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FacultyCard;

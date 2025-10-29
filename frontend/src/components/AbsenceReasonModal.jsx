import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

const AbsenceReasonModal = ({ isOpen, onClose, attendance, studentId, classId, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiFetch({
        url: '/api/attendance/reason',
        method: 'POST',
        data: {
          classId: classId,
          date: attendance.date,
          studentId: studentId,
          reason: reason.trim()
        }
      });

      if (response.data.success) {
        onSuccess(response.data.data);
        handleClose();
      } else {
        setError(response.data.message || 'Failed to submit reason');
      }
    } catch (err) {
      console.error('Error submitting reason:', err);
      setError(err.response?.data?.message || 'Failed to submit reason. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-xl">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Submit Absence Reason
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-700">
                <strong>Date:</strong> {new Date(attendance.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <p className="text-sm text-red-600 mt-1">
                <strong>Status:</strong> Absent
              </p>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Absence <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
              placeholder="Please provide a detailed reason for your absence (minimum 10 characters)..."
              required
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                Minimum 10 characters required
              </p>
              <p className="text-xs text-gray-500">
                {reason.length}/500
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 10}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Reason</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AbsenceReasonModal;



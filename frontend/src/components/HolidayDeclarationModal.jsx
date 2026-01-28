import { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

const HolidayDeclarationModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  classData 
}) => {
  const [formData, setFormData] = useState({
    date: '',
    reason: '',
    scope: 'class'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🎉 Holiday modal - classData:', classData);
    console.log('🎉 Holiday modal - formData:', formData);

    try {
      // Convert date to ISO format for backend
      const dateObj = new Date(formData.date);
      const isoDate = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format

      const requestData = {
        date: isoDate,
        reason: formData.reason,
        scope: formData.scope
      };

      // Add class-specific data if scope is 'class'
      if (formData.scope === 'class') {
        if (!classData) {
          setError('Class data is required for class-specific holidays');
          return;
        }
        
        // Normalize semester value - remove "Sem " prefix if present to match backend storage format
        let normalizedSemester = classData.semester;
        if (typeof normalizedSemester === 'string' && normalizedSemester.startsWith('Sem ')) {
          normalizedSemester = normalizedSemester.replace(/^Sem\s+/i, '');
        }
        
        requestData.batchYear = classData.batch;
        requestData.section = classData.section;
        requestData.semester = normalizedSemester;
        
        console.log('🎉 Normalized semester for holiday declaration:', {
          original: classData.semester,
          normalized: normalizedSemester
        });
      }

      console.log('🎉 Sending holiday declaration request:', requestData);
      console.log('🎉 Request data types:', {
        date: typeof requestData.date,
        reason: typeof requestData.reason,
        scope: typeof requestData.scope,
        batchYear: typeof requestData.batchYear,
        section: typeof requestData.section,
        semester: typeof requestData.semester
      });

      const response = await apiFetch({
        url: '/api/holidays/declare',
        method: 'POST',
        data: requestData
      });

      if (response.data.status === 'success') {
        // Show success message indicating approval is pending
        alert(`Holiday request submitted successfully!\n\nRequest ID: ${response.data.data.requestId}\n\nYour holiday request is now pending Principal approval. You will be notified once it's approved.`);
        onSuccess(response.data.data);
        handleClose();
      } else {
        // Show detailed error message
        const errorMessage = response.data.message || 'Failed to declare holiday';
        const validationErrors = response.data.errors?.map(err => err.msg).join(', ');
        setError(validationErrors || errorMessage);
      }
    } catch (err) {
      console.error('Error declaring holiday:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to declare holiday. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      date: '',
      reason: '',
      scope: 'class'
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Declare Holiday
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scope
            </label>
            <select
              name="scope"
              value={formData.scope}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="class">Class-specific Holiday</option>
              <option value="global">Global Holiday (All Classes)</option>
            </select>
          </div>

          {formData.scope === 'class' && classData && (
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Class:</strong> {classData.batch} - {classData.section} - {classData.semester}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="e.g., Diwali, Christmas, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={255}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Declaring...' : 'Declare Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HolidayDeclarationModal;

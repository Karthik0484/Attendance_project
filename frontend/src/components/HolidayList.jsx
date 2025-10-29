import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const HolidayList = ({ 
  classData, 
  onHolidayUpdate,
  showActions = true 
}) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    if (classData) {
      fetchHolidays();
    }
  }, [classData]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        scope: 'class',
        batchYear: classData.batch,
        section: classData.section,
        semester: classData.semester
      });

      const response = await apiFetch({
        url: `/api/holidays?${queryParams}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setHolidays(response.data.data);
      } else {
        setError('Failed to fetch holidays');
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setEditReason(holiday.reason);
  };

  const handleUpdate = async () => {
    if (!editingHoliday || !editReason.trim()) return;

    try {
      const response = await apiFetch({
        url: `/api/holidays/${editingHoliday.holidayId}`,
        method: 'PUT',
        body: { reason: editReason.trim() }
      });

      if (response.data.status === 'success') {
        setHolidays(prev => prev.map(h => 
          h.holidayId === editingHoliday.holidayId 
            ? { ...h, reason: editReason.trim() }
            : h
        ));
        setEditingHoliday(null);
        setEditReason('');
        onHolidayUpdate && onHolidayUpdate();
      } else {
        setError(response.data.message || 'Failed to update holiday');
      }
    } catch (err) {
      console.error('Error updating holiday:', err);
      setError('Failed to update holiday');
    }
  };

  const handleDelete = async (holidayId) => {
    if (!window.confirm('Are you sure you want to deactivate this holiday?')) {
      return;
    }

    try {
      const response = await apiFetch({
        url: `/api/holidays/${holidayId}`,
        method: 'DELETE'
      });

      if (response.data.status === 'success') {
        setHolidays(prev => prev.filter(h => h.holidayId !== holidayId));
        onHolidayUpdate && onHolidayUpdate();
      } else {
        setError(response.data.message || 'Failed to deactivate holiday');
      }
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setError('Failed to deactivate holiday');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Declared Holidays
        </h3>
        <span className="text-sm text-gray-500">
          {holidays.length} holiday{holidays.length !== 1 ? 's' : ''}
        </span>
      </div>

      {holidays.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📅</div>
          <p>No holidays declared for this class</p>
        </div>
      ) : (
        <div className="space-y-2">
          {holidays.map((holiday) => (
            <div
              key={holiday.holidayId}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-yellow-600 font-medium">
                      {formatDate(holiday.date)}
                    </span>
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                      {holiday.scope === 'global' ? 'Global' : 'Class'}
                    </span>
                  </div>
                  
                  {editingHoliday?.holidayId === holiday.holidayId ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Enter holiday reason"
                      />
                      <button
                        onClick={handleUpdate}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingHoliday(null);
                          setEditReason('');
                        }}
                        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-700 text-sm">
                      {holiday.reason}
                    </p>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-1">
                    Declared by {holiday.declaredBy} on{' '}
                    {new Date(holiday.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {showActions && (
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={() => handleEdit(holiday)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Edit holiday"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(holiday.holidayId)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Deactivate holiday"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HolidayList;

import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const StudentHolidayCalendar = ({ 
  classData, 
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear()
}) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (classData) {
      fetchHolidays();
    }
  }, [classData, selectedMonth, selectedYear]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        scope: 'class',
        batchYear: classData.batch,
        section: classData.section,
        semester: classData.semester,
        month: selectedMonth,
        year: selectedYear
      });

      const response = await apiFetch({
        url: `/api/holidays/analytics?${queryParams}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setHolidays(response.data.data.holidays || []);
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getHolidayIcon = (scope) => {
    return scope === 'global' ? '🌍' : '🎉';
  };

  const getHolidayColor = (scope) => {
    return scope === 'global' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800';
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
          Holidays - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <span className="text-sm text-gray-500">
          {holidays.length} holiday{holidays.length !== 1 ? 's' : ''}
        </span>
      </div>

      {holidays.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📅</div>
          <p>No holidays in this month</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {holidays.map((holiday, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getHolidayColor(holiday.scope)}`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {getHolidayIcon(holiday.scope)}
                </span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium">
                      {formatDate(holiday.date)}
                    </span>
                    <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                      {holiday.scope === 'global' ? 'Global' : 'Class'}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {holiday.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentHolidayCalendar;

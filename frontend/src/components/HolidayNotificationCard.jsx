import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const HolidayNotificationCard = ({ compact = false }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHolidays();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchHolidays();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchHolidays = async () => {
    try {
      // Get upcoming holidays (next 30 days)
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);

      const response = await apiFetch({
        url: `/api/holidays/student?startDate=${today.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}&limit=5`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        setHolidays(response.data.data.holidays || []);
        setError('');
      } else {
        setError('Failed to fetch holidays');
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
      // Don't show error to students if endpoint isn't accessible
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return 'Today';
    } else if (isTomorrow) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent"></div>
          <span className="text-gray-600 text-sm font-medium">Loading holidays...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Don't show error card to students
  }

  if (holidays.length === 0) {
    return null; // Don't show card if no holidays
  }

  return (
    <div className={`relative bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 rounded-xl shadow-2xl overflow-hidden ${compact ? 'p-5' : 'p-6'}`}>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            {/* Calendar Icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className={`font-bold text-white ${compact ? 'text-lg' : 'text-xl'}`}>
                Upcoming Holidays
              </h3>
              <p className="text-purple-100 text-xs">
                Your upcoming breaks and celebrations
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white font-bold text-sm">
              {holidays.length} {holidays.length === 1 ? 'holiday' : 'holidays'}
            </span>
          </div>
        </div>

        {/* Holiday Cards */}
        <div className="space-y-3">
          {holidays.slice(0, compact ? 3 : 5).map((holiday, index) => (
            <div
              key={index}
              className="bg-white/95 backdrop-blur-sm rounded-lg p-4 border border-white/50 hover:bg-white transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Date Badge */}
                  <div className="inline-flex items-center space-x-2 mb-2">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                      <span className="text-white text-sm font-bold">
                        {new Date(holiday.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">
                        {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' })}
                      </p>
                    </div>
                  </div>

                  {/* Holiday Reason */}
                  <p className="text-gray-900 font-semibold text-base group-hover:text-purple-700 transition-colors">
                    {holiday.reason}
                  </p>

                  {/* Declared By & Scope */}
                  <div className="mt-2 flex items-center space-x-2">
                    {holiday.scope === 'global' && (
                      <div className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                        </svg>
                        <span>Department-wide</span>
                      </div>
                    )}
                    {holiday.declaredBy && (
                      <p className="text-xs text-gray-500">
                        by {holiday.declaredBy}
                      </p>
                    )}
                  </div>
                </div>

                {/* Days until badge */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const holidayDate = new Date(holiday.date);
                  holidayDate.setHours(0, 0, 0, 0);
                  const daysUntil = Math.ceil((holidayDate - today) / (1000 * 60 * 60 * 24));
                  
                  if (daysUntil === 0) {
                    return (
                      <div className="flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        Today
                      </div>
                    );
                  } else if (daysUntil === 1) {
                    return (
                      <div className="flex-shrink-0 bg-gradient-to-br from-orange-500 to-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        Tomorrow
                      </div>
                    );
                  } else if (daysUntil <= 7) {
                    return (
                      <div className="flex-shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        {daysUntil} days
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* Show more indicator */}
        {holidays.length > (compact ? 3 : 5) && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
              <span>+{holidays.length - (compact ? 3 : 5)} more upcoming</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HolidayNotificationCard;



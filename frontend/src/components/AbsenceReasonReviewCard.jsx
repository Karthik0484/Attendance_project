import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';

const AbsenceReasonReviewCard = ({ department, classId }) => {
  const [pendingReasons, setPendingReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [facultyNotes, setFacultyNotes] = useState({}); // Store notes for each reason separately

  const fetchPendingReasons = async () => {
    try {
      console.log('🔍 Fetching pending reasons with params:', { department, classId });
      
      const response = await apiFetch({
        url: '/api/attendance/reasons/pending',
        method: 'GET',
        params: { department, classId }
      });

      console.log('📋 Pending reasons response:', response.data);

      if (response.data.success) {
        setPendingReasons(response.data.data.pendingReasons || []);
        console.log('✅ Set pending reasons:', response.data.data.pendingReasons?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error fetching pending reasons:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReasons();
    
    // Poll every 15 seconds for new submissions
    const interval = setInterval(fetchPendingReasons, 15000);
    
    return () => clearInterval(interval);
  }, [department, classId]);

  const handleReview = async (reason) => {
    const reasonKey = reason.studentId + reason.date;
    setReviewing(reasonKey);
    
    try {
      const noteForThisReason = facultyNotes[reasonKey] || '';
      
      console.log('🔄 Submitting review for:', {
        classId: reason.classId,
        date: reason.date,
        studentId: reason.studentId,
        facultyNote: noteForThisReason || 'none'
      });

      const response = await apiFetch({
        url: '/api/attendance/reason/review',
        method: 'PUT',
        data: {
          classId: reason.classId,
          date: reason.date,
          studentId: reason.studentId,
          facultyNote: noteForThisReason || undefined
        }
      });

      console.log('✅ Review response:', response.data);

      if (response.data.success) {
        // Remove from pending list
        setPendingReasons(prev => 
          prev.filter(r => !(r.studentId === reason.studentId && r.date === reason.date))
        );
        // Clear the note for this reason
        setFacultyNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[reasonKey];
          return newNotes;
        });
        console.log('✅ Review completed successfully');
      }
    } catch (error) {
      console.error('❌ Error reviewing reason:', error);
      console.error('❌ Error response:', error.response?.data);
      alert(`Failed to review: ${error.response?.data?.message || error.message}`);
    } finally {
      setReviewing(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (pendingReasons.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Pending Absence Reasons</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <div className="flex justify-center mb-3">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">All caught up!</p>
          <p className="text-sm text-gray-500 mt-1">No pending absence reasons to review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Pending Absence Reasons</h3>
        </div>
        <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
          {pendingReasons.length} Pending
        </span>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {pendingReasons.map((reason, idx) => (
          <div key={`${reason.studentId}-${reason.date}-${idx}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-gray-900">{reason.studentName}</p>
                <p className="text-sm text-gray-600">{reason.rollNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {new Date(reason.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </p>
                <span className="text-xs text-yellow-600">
                  {reason.submittedAt ? `Submitted ${new Date(reason.submittedAt).toLocaleDateString()}` : 'Recently submitted'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-500 mb-3">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Student's Reason:</span>
              </p>
              <p className="text-sm text-gray-800 mt-1">{reason.reason}</p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faculty Note (Optional)
              </label>
              <textarea
                value={facultyNotes[reason.studentId + reason.date] || ''}
                onChange={(e) => {
                  const reasonKey = reason.studentId + reason.date;
                  setFacultyNotes(prev => ({
                    ...prev,
                    [reasonKey]: e.target.value
                  }));
                }}
                disabled={reviewing === (reason.studentId + reason.date)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Add your note or comment (optional)..."
                rows={2}
                maxLength={500}
              />
            </div>

            <button
              onClick={() => handleReview(reason)}
              disabled={reviewing === (reason.studentId + reason.date)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {reviewing === (reason.studentId + reason.date) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Reviewing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Mark as Reviewed</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AbsenceReasonReviewCard;



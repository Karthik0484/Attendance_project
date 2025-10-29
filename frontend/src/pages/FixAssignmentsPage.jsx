import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import { useNavigate } from 'react-router-dom';

const FixAssignmentsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFix = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      console.log('🔧 Calling fix API...');

      const response = await apiFetch({
        url: '/api/class-assignment/fix-multiple-active',
        method: 'POST'
      });

      console.log('📊 Fix result:', response.data);

      if (response.data.status === 'success') {
        setResult(response.data);
      } else {
        setError(response.data.message || 'Fix failed');
      }
    } catch (err) {
      console.error('❌ Error fixing assignments:', err);
      setError(err.message || 'Failed to fix assignments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Fix Multiple Active Assignments
          </h1>
          <p className="text-gray-600">
            This will automatically deactivate old assignments and keep only the most recent one active for each faculty.
          </p>
        </div>

        {/* Fix Button */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center">
            <button
              onClick={handleFix}
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg transition-colors inline-flex items-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fixing...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Fix Multiple Active Assignments
                </>
              )}
            </button>
          </div>

          <div className="mt-4 text-sm text-gray-500 text-center">
            <p>⚠️ This will keep only the most recent assignment active for each faculty</p>
            <p>✅ All old data will be preserved and marked as "Inactive"</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-red-800">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Display */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold text-green-800 text-xl">{result.message}</h3>
                  <p className="text-green-700">{result.data.deactivatedCount} old assignments deactivated</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-gray-600">Faculty Fixed</p>
                  <p className="text-3xl font-bold text-green-700">{result.data.fixedCount}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-gray-600">Assignments Deactivated</p>
                  <p className="text-3xl font-bold text-green-700">{result.data.deactivatedCount}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            {result.data.fixedFaculty && result.data.fixedFaculty.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-4">Fixed Faculty Details</h3>
                <div className="space-y-3">
                  {result.data.fixedFaculty.map((item, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            ✅ Kept Active: <span className="text-green-600">{item.kept}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            📦 Deactivated {item.deactivated} older assignment{item.deactivated > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/class-management')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
              >
                Go to Class Management
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-semibold transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}

        {/* Back Button */}
        {!result && !loading && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FixAssignmentsPage;


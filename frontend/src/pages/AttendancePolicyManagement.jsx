import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';

const AttendancePolicyManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        url: '/api/hod/settings',
        method: 'GET'
      });

      if (response.data.success) {
        setSettings(response.data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiFetch({
        url: '/api/hod/settings',
        method: 'PUT',
        data: settings
      });

      if (response.data.success) {
        showToast('Settings updated successfully!', 'success');
        setSettings(response.data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const updateNestedField = (path, value) => {
    const newSettings = { ...settings };
    const keys = path.split('.');
    let current = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    setSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">Failed to load settings.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast.show && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          } animate-fade-in`}>
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => navigate('/hod/dashboard')}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
        >
          <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Attendance Policy Management</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
              {user.department}
            </span>
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            )}
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Attendance Policy Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Attendance Policy
              </h2>
              <p className="text-sm text-gray-500 mt-1">Define minimum requirements and thresholds</p>
            </div>

            <div className="space-y-5">
              {/* Minimum Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Attendance Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.attendancePolicy.minimumPercentage}
                  onChange={(e) => updateNestedField('attendancePolicy.minimumPercentage', parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">Students below this threshold will be marked as defaulters</p>
              </div>

              {/* Grace Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grace Days
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.attendancePolicy.graceDays}
                  onChange={(e) => updateNestedField('attendancePolicy.graceDays', parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">Number of days students can be absent without penalty</p>
              </div>

              {/* Absence Tolerance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consecutive Absence Tolerance
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.attendancePolicy.absenceTolerance}
                  onChange={(e) => updateNestedField('attendancePolicy.absenceTolerance', parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">Maximum consecutive absences before triggering alert</p>
              </div>

              {/* Warning Thresholds */}
              <div className="border-t border-gray-100 pt-5 mt-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Warning Thresholds</h3>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Critical Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.attendancePolicy.warningThresholds.critical}
                      onChange={(e) => updateNestedField('attendancePolicy.warningThresholds.critical', parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      Warning Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.attendancePolicy.warningThresholds.warning}
                      onChange={(e) => updateNestedField('attendancePolicy.warningThresholds.warning', parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Good Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.attendancePolicy.warningThresholds.good}
                      onChange={(e) => updateNestedField('attendancePolicy.warningThresholds.good', parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Notification Settings Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Auto Notification Settings
              </h2>
              <p className="text-sm text-gray-500 mt-1">Configure automated alerts and notifications</p>
            </div>

            <div className="space-y-5">
              {/* Master Toggle */}
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                <label className="flex items-start justify-between cursor-pointer">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 mb-1">Enable Auto Notifications</div>
                    <p className="text-sm text-gray-600">Automatically send alerts based on attendance</p>
                  </div>
                  <div className="relative ml-4">
                    <input
                      type="checkbox"
                      checked={settings.autoNotifications.enabled}
                      onChange={(e) => updateNestedField('autoNotifications.enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </label>
              </div>

              {/* Individual Notification Settings */}
              <div className={`space-y-3 ${!settings.autoNotifications.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="p-4 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm">Notify Faculty on Low Attendance</div>
                      <p className="text-xs text-gray-600 mt-1">Alert faculty when class attendance drops below threshold</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoNotifications.notifyFacultyOnLowAttendance}
                      onChange={(e) => updateNestedField('autoNotifications.notifyFacultyOnLowAttendance', e.target.checked)}
                      className="ml-4 w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </label>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm">Notify Students on Defaulter Status</div>
                      <p className="text-xs text-gray-600 mt-1">Alert students when they fall below minimum attendance</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoNotifications.notifyStudentsOnDefaulter}
                      onChange={(e) => updateNestedField('autoNotifications.notifyStudentsOnDefaulter', e.target.checked)}
                      className="ml-4 w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </label>
                </div>

                <div className="p-4 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                  <label className="flex items-start justify-between cursor-pointer">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 text-sm">Notify HOD on Trends</div>
                      <p className="text-xs text-gray-600 mt-1">Send weekly summary of attendance trends</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoNotifications.notifyHODOnTrends}
                      onChange={(e) => updateNestedField('autoNotifications.notifyHODOnTrends', e.target.checked)}
                      className="ml-4 w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Department Goals */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Department Goals
                </h3>
                <p className="text-xs text-gray-500 mt-1">Set target metrics for overall performance</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Department Average (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.targetMetrics.departmentAverageAttendance}
                    onChange={(e) => updateNestedField('targetMetrics.departmentAverageAttendance', parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Class Average (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.targetMetrics.classAverageAttendance}
                    onChange={(e) => updateNestedField('targetMetrics.classAverageAttendance', parseFloat(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Policy Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendancePolicyManagement;

import { useState, useRef } from 'react';
import { apiFetch } from '../utils/apiFetch';
import usePreventBodyScroll from '../hooks/usePreventBodyScroll';

const ProfileModal = ({ profileData, summary, onClose, onUpdate }) => {
  console.log('🎨 ProfileModal received profileData:', profileData);
  console.log('🎨 ProfileModal received summary:', summary);
  
  // Prevent background scrolling when modal is open
  usePreventBodyScroll(!!profileData);
  
  const modalContentRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profileData?.name || '',
    phone: profileData?.phone || '',
    address: profileData?.address || ''
  });
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoPreview, setPhotoPreview] = useState(profileData?.profilePhoto ? `http://localhost:5000${profileData.profilePhoto}` : null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setPhotoLoading(true);
    setError('');
    setSuccess('');

    try {
      const formDataObj = new FormData();
      formDataObj.append('photo', file);

      const response = await apiFetch({
        url: '/api/faculty/me/photo',
        method: 'POST',
        data: formDataObj,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess('Profile photo uploaded successfully!');
        setPhotoPreview(`http://localhost:5000${response.data.data.profilePhoto}`);
        // Update parent component data without closing modal
        onUpdate();
        // Scroll to top of modal to show success message
        if (modalContentRef.current) {
          modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
      // Scroll to top to show error message
      if (modalContentRef.current) {
        modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setPhotoLoading(false);
    }
  };

  const handlePhotoDelete = async () => {
    setPhotoLoading(true);
    setError('');
    setSuccess('');
    setShowDeleteConfirm(false);

    try {
      const response = await apiFetch({
        url: '/api/faculty/me/photo',
        method: 'DELETE'
      });

      if (response.data.success) {
        setSuccess('Profile photo deleted successfully!');
        setPhotoPreview(null);
        // Update parent component data without closing modal
        onUpdate();
        // Scroll to top of modal to show success message
        if (modalContentRef.current) {
          modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete photo');
      // Scroll to top to show error message
      if (modalContentRef.current) {
        modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiFetch({
        url: '/api/faculty/me/update',
        method: 'PUT',
        data: formData
      });

      if (response.data.success) {
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        // Update parent component data without closing modal
        onUpdate();
        // Scroll to top of modal to show success message
        if (modalContentRef.current) {
          modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
      // Scroll to top to show error message
      if (modalContentRef.current) {
        modalContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Faculty Profile</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={modalContentRef} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-800 font-medium">{success}</span>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          )}

          {/* Profile Information */}
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center space-x-4 pb-6 border-b">
              <div className="relative group">
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover shadow-lg ring-4 ring-blue-100 transition-all"
                    />
                    {/* Dark overlay on hover */}
                    {!photoLoading && (
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-full transition-all duration-300 flex items-center justify-center">
                        {/* Delete Button - Shows on hover */}
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 bg-red-500 rounded-full p-3 shadow-xl hover:bg-red-600 border-2 border-white"
                          title="Delete photo"
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-3xl">
                      {profileData?.name?.charAt(0) || 'F'}
                    </span>
                  </div>
                )}
                
                {/* Edit/Upload Button */}
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md cursor-pointer hover:bg-blue-50 hover:scale-110 transition-all duration-200 border border-blue-500"
                  title={photoPreview ? "Change photo" : "Upload photo"}
                >
                  {photoLoading ? (
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600"></div>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </label>
                
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={photoLoading}
                />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{profileData?.name}</h3>
                <p className="text-gray-600">{profileData?.role}</p>
                <p className="text-sm text-gray-500">Faculty ID: {profileData?.facultyId}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {photoPreview ? 'Hover on photo to delete • Click camera to change' : 'Click camera icon to upload photo'}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  ) : (
                    <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{profileData?.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <p className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600">{profileData?.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <p className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600">{profileData?.department}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      pattern="[0-9]{10}"
                      placeholder="10-digit phone number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{profileData?.phone || 'Not provided'}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                {isEditing ? (
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Enter your address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                ) : (
                  <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{profileData?.address || 'Not provided'}</p>
                )}
              </div>

              {/* Summary Stats */}
              {summary && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-3">Teaching Summary</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{summary.totalClasses}</p>
                      <p className="text-sm text-gray-600 mt-1">Assigned Classes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{summary.totalStudents}</p>
                      <p className="text-sm text-gray-600 mt-1">Total Students</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-600">{summary.activeSemesters?.length || 0}</p>
                      <p className="text-sm text-gray-600 mt-1">Active Semesters</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: profileData?.name || '',
                          phone: profileData?.phone || '',
                          address: profileData?.address || ''
                        });
                        setError('');
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Toast - Centered in Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[70] rounded-lg animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border-l-4 border-red-500 max-w-md mx-4 transform scale-100 animate-fadeIn">
            <div className="p-5">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900">Delete Profile Photo?</p>
                  <p className="text-sm text-gray-600 mt-1.5">
                    This action cannot be undone.
                  </p>
                  <div className="flex space-x-3 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePhotoDelete}
                      className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileModal;


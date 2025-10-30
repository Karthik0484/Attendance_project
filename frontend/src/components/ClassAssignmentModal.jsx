import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
import Toast from './Toast';
import usePreventBodyScroll from '../hooks/usePreventBodyScroll';

const ClassAssignmentModal = ({ isOpen, onClose, faculty, onAssignmentUpdated }) => {
  const [formData, setFormData] = useState({
    batch: '',
    year: '',
    semester: '',
    section: '',
    notes: ''
  });
  const [availableClasses, setAvailableClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [errors, setErrors] = useState({});

  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const sections = ['A', 'B', 'C'];
  
  // Prevent background scrolling when modal is open
  usePreventBodyScroll(isOpen);
  
  // Dynamic semester options based on year
  const getSemesterOptions = (year) => {
    const semesterMap = {
      '1st Year': [1, 2],
      '2nd Year': [3, 4],
      '3rd Year': [5, 6],
      '4th Year': [7, 8]
    };
    return semesterMap[year] || [];
  };

  // Fetch available classes when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableClasses();
    }
  }, [isOpen]);

  const fetchAvailableClasses = async () => {
    try {
      const response = await apiFetch({
        url: '/api/class-assignment/available-classes',
        method: 'GET'
      });
      
      if (response.data.status === 'success') {
        setAvailableClasses(response.data.data.availableClasses || []);
        setAssignedClasses(response.data.data.assignedClasses || []);
      } else {
        console.error('Failed to fetch available classes:', response.data.message);
        setToast({ show: true, message: response.data.message || 'Failed to load available classes', type: 'error' });
      }
    } catch (error) {
      console.error('Error fetching available classes:', error);
      setToast({ show: true, message: 'Failed to load available classes. Please try again.', type: 'error' });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };
      
      // Reset semester when year changes
      if (name === 'year') {
        newData.semester = '';
      }
      
      return newData;
    });
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.batch) {
      newErrors.batch = 'Batch is required';
    }
    
    if (!formData.year) {
      newErrors.year = 'Year is required';
    }
    
    if (!formData.semester) {
      newErrors.semester = 'Semester is required';
    } else if (formData.year) {
      // Validate semester based on year
      const validSemesters = getSemesterOptions(formData.year);
      if (!validSemesters.includes(parseInt(formData.semester))) {
        newErrors.semester = `Invalid semester for ${formData.year}. Valid semesters are: ${validSemesters.join(', ')}`;
      }
    }
    
    if (!formData.section) {
      newErrors.section = 'Section is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToast({ show: true, message: 'Please fix the validation errors', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch({
        url: `/api/class-assignment`,
        method: 'POST',
        data: {
          facultyId: faculty._id,
          batch: formData.batch,
          year: formData.year,
          semester: parseInt(formData.semester),
          section: formData.section,
          notes: formData.notes
        }
      });

      if (response.data.status === 'success') {
        const { assignment, replacedAdvisor } = response.data.data;
        
        let successMessage = `✅ Class advisor assigned successfully for ${formData.year} | Semester ${formData.semester} | Section ${formData.section}`;
        
        if (replacedAdvisor) {
          successMessage += ` (Replaced ${replacedAdvisor.name})`;
        }
        
        setToast({ 
          show: true, 
          message: successMessage, 
          type: 'success' 
        });
        
        setTimeout(() => {
          onAssignmentUpdated();
          handleClose();
        }, 1500);
      } else {
        setToast({ show: true, message: response.data.message || 'Failed to assign class advisor', type: 'error' });
      }
    } catch (error) {
      console.error('Error assigning class advisor:', error);
      const errorMessage = error.response?.data?.message || 'Failed to assign class advisor';
      setToast({ show: true, message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      batch: '',
      year: '',
      semester: '',
      section: '',
      notes: ''
    });
    setErrors({});
    setToast({ show: false, message: '', type: 'success' });
    onClose();
  };

  const getAvailableBatches = () => {
    const batches = [];
    const startFromYear = 2022; // Start from 2022
    const numberOfBatches = 15; // Generate 15 batches (2022-2026 through 2036-2040)
    
    for (let i = 0; i < numberOfBatches; i++) {
      const startYear = startFromYear + i;
      const endYear = startYear + 4;
      batches.push(`${startYear}-${endYear}`);
    }
    return batches;
  };

  const getFilteredAvailableClasses = () => {
    if (!formData.batch || !formData.year || !formData.semester) {
      return availableClasses;
    }

    return availableClasses.filter(cls => 
      cls.batch === formData.batch && 
      cls.year === formData.year && 
      cls.semester === parseInt(formData.semester)
    );
  };

  if (!isOpen || !faculty) return null;

  return (
    <>
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
      
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Assign Class Advisor</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-2xl p-1"
              >
                ×
              </button>
            </div>

            {/* Faculty Info */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Faculty Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2 text-gray-900">{faculty.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">{faculty.email}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Position:</span>
                  <span className="ml-2 text-gray-900">{faculty.position}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Department:</span>
                  <span className="ml-2 text-gray-900">{faculty.department}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Class Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch *
                  </label>
                  <select
                    name="batch"
                    value={formData.batch}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                      errors.batch ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Batch</option>
                    {getAvailableBatches().map(batch => (
                      <option key={batch} value={batch}>{batch}</option>
                    ))}
                  </select>
                  {errors.batch && (
                    <p className="text-red-500 text-xs mt-1">{errors.batch}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year *
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                      errors.year ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Year</option>
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  {errors.year && (
                    <p className="text-red-500 text-xs mt-1">{errors.year}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester *
                  </label>
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                      errors.semester ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Semester</option>
                    {getSemesterOptions(formData.year).map(sem => (
                      <option key={sem} value={sem}>Semester {sem}</option>
                    ))}
                  </select>
                  {errors.semester && (
                    <p className="text-red-500 text-xs mt-1">{errors.semester}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section *
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                      errors.section ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select Section</option>
                    {sections.map(section => (
                      <option key={section} value={section}>Section {section}</option>
                    ))}
                  </select>
                  {errors.section && (
                    <p className="text-red-500 text-xs mt-1">{errors.section}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={500}
                  placeholder="Add any notes about this assignment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.notes.length}/500 characters
                </p>
              </div>

              {/* Section Status Preview */}
              {formData.batch && formData.year && formData.semester && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Section Status
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {sections.map((section) => {
                      const isAvailable = getFilteredAvailableClasses().some(cls => cls.section === section);
                      const isSelected = formData.section === section;
                      const assignedClass = assignedClasses.find(
                        cls => cls.batch === formData.batch && 
                               cls.year === formData.year && 
                               cls.semester === parseInt(formData.semester) && 
                               cls.section === section
                      );

                      return (
                        <div
                          key={section}
                          className={`inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg border-2 ${
                            isSelected
                              ? 'bg-indigo-100 border-indigo-500 text-indigo-800'
                              : isAvailable
                              ? 'bg-green-50 border-green-300 text-green-800'
                              : 'bg-gray-50 border-gray-300 text-gray-700'
                          }`}
                        >
                          <span className="font-semibold">Section {section}</span>
                          {assignedClass && (
                            <span className="ml-2 text-xs opacity-75">
                              ({assignedClass.facultyName})
                            </span>
                          )}
                          {isSelected && !assignedClass && (
                            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-300"></div>
                      <span className="text-gray-700">Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      <span className="text-gray-700">Assigned</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                      <span className="text-gray-700">Your Selection</span>
                    </div>
                  </div>
                  {assignedClasses.find(
                    cls => cls.batch === formData.batch && 
                           cls.year === formData.year && 
                           cls.semester === parseInt(formData.semester) && 
                           cls.section === formData.section
                  ) && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-800">
                        ⚠️ This section is already assigned. Proceeding will replace the current advisor.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Assigning...' : 'Assign Class Advisor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClassAssignmentModal;


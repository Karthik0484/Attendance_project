import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiFetch';
import Toast from '../components/Toast';
import EnhancedFacultyNavbar from '../components/EnhancedFacultyNavbar';
import Footer from '../components/Footer';

const ODRequestForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [formData, setFormData] = useState({
    studentId: '',
    date: '',
    reason: '',
    classId: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      // Fetch faculty's assigned classes first
      const classesResponse = await apiFetch({
        url: `/api/faculty/${user.id}/classes`,
        method: 'GET'
      });

      if (classesResponse.data.success && classesResponse.data.data.length > 0) {
        // Get students from all assigned classes
        const allStudents = [];
        for (const classData of classesResponse.data.data) {
          try {
            const studentsResponse = await apiFetch({
              url: `/api/classes/${classData.classId}/students`,
              method: 'GET'
            });

            if (studentsResponse.data.success) {
              const classStudents = studentsResponse.data.data.students || [];
              // Add classId to each student for reference
              classStudents.forEach(student => {
                if (!allStudents.find(s => s._id.toString() === student._id.toString())) {
                  allStudents.push({ ...student, classId: classData.classId });
                }
              });
            }
          } catch (err) {
            console.error(`Error fetching students for class ${classData.classId}:`, err);
          }
        }
        setStudents(allStudents);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setToast({
        show: true,
        message: 'Failed to load students. Please try again.',
        type: 'error'
      });
    }
  };

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.studentId) {
      newErrors.studentId = 'Please select a student';
    }

    if (!formData.date) {
      newErrors.date = 'Please select an OD date';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      
      const diffTime = selectedDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 1) {
        newErrors.date = 'OD must be requested at least one day before the OD date';
      }
    }

    if (!formData.reason || formData.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a clear reason with at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleStudentSelect = (student) => {
    setFormData(prev => ({
      ...prev,
      studentId: student._id,
      classId: student.classId || ''
    }));
    setSearchQuery('');
    setErrors(prev => ({ ...prev, studentId: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToast({
        show: true,
        message: 'Please fix the errors in the form',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch({
        url: '/api/approvals/od-request',
        method: 'POST',
        data: {
          studentId: formData.studentId,
          date: formData.date,
          reason: formData.reason.trim(),
          classId: formData.classId
        }
      });

      if (response.data.success) {
        setToast({
          show: true,
          message: response.data.msg || 'OD request submitted successfully! Waiting for Principal approval.',
          type: 'success'
        });
        
        // Reset form
        setFormData({
          studentId: '',
          date: '',
          reason: '',
          classId: ''
        });
        setSearchQuery('');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/faculty/dashboard');
        }, 2000);
      } else {
        setToast({
          show: true,
          message: response.data.msg || 'Failed to submit OD request',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error submitting OD request:', error);
      const errorMessage = error.response?.data?.msg || error.message || 'Failed to submit OD request';
      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const query = searchQuery.toLowerCase();
    return (
      student.name?.toLowerCase().includes(query) ||
      student.rollNumber?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  const selectedStudent = students.find(s => s._id.toString() === formData.studentId);

  return (
    <div className="min-h-screen bg-gray-50">
      <EnhancedFacultyNavbar />
      
      <main className="pt-20 sm:pt-24 md:pt-28 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/faculty/dashboard')}
              className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Submit OD Request</h1>
            <p className="mt-2 text-gray-600">
              Request On Duty (OD) status for students. Requests must be submitted at least one day in advance.
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Student Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, roll number, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchQuery('')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  
                  {searchQuery && filteredStudents.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredStudents.map(student => (
                        <button
                          key={student._id}
                          type="button"
                          onClick={() => handleStudentSelect(student)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{student.name}</div>
                          <div className="text-sm text-gray-500">
                            {student.rollNumber} • {student.email}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedStudent && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-medium text-blue-900">Selected: {selectedStudent.name}</div>
                    <div className="text-sm text-blue-700">
                      Roll No: {selectedStudent.rollNumber} • Email: {selectedStudent.email}
                    </div>
                  </div>
                )}
                
                {errors.studentId && (
                  <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>
                )}
              </div>

              {/* OD Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OD Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  min={getMinDate()}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Only future dates (tomorrow or later) are allowed. Same-day and past dates are not permitted.
                </p>
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Minimum 10 characters)</span>
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Provide a clear and detailed reason for the OD request..."
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.reason ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <div className="mt-1 flex justify-between items-center">
                  <div>
                    {errors.reason && (
                      <p className="text-sm text-red-600">{errors.reason}</p>
                    )}
                  </div>
                  <p className={`text-xs ${
                    formData.reason.trim().length < 10 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {formData.reason.trim().length}/10 characters
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/faculty/dashboard')}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.studentId || !formData.date || formData.reason.trim().length < 10}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Submitting...' : 'Submit OD Request'}
                </button>
              </div>
            </form>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Important Notes:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>OD requests must be submitted at least one day before the OD date</li>
              <li>All requests require Principal approval</li>
              <li>You will be notified once the request is approved or rejected</li>
              <li>Approved ODs will automatically be marked in the attendance system</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
};

export default ODRequestForm;


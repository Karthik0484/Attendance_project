import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const { login, error, clearError, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const roles = [
    { value: 'admin', label: 'Admin', color: 'from-red-500 to-pink-500', bgColor: 'bg-red-50', textColor: 'text-red-600' },
    { value: 'principal', label: 'Principal', color: 'from-purple-500 to-indigo-500', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
    { value: 'hod', label: 'HOD', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { value: 'faculty', label: 'Faculty', color: 'from-green-500 to-teal-500', bgColor: 'bg-green-50', textColor: 'text-green-600' },
    { value: 'student', label: 'Student', color: 'from-orange-500 to-yellow-500', bgColor: 'bg-orange-50', textColor: 'text-orange-600' }
  ];

  // Only redirect if not loading and authenticated
  // This prevents flicker and infinite redirects
  // IMPORTANT: Use user.role from auth context, NOT formData.role
  // formData.role is just the selected role in the form, user.role is the actual authenticated role
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      // Redirect based on ACTUAL user role from backend
      const roleRoutes = {
        admin: '/admin/dashboard',
        principal: '/principal/dashboard',
        hod: '/hod/dashboard',
        faculty: '/class-management',
        student: '/student/dashboard'
      };
      const redirectPath = roleRoutes[user.role] || from || '/dashboard';
      console.log('🔄 Redirecting based on user role:', user.role, 'to:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, loading, user, navigate, from]);

  useEffect(() => {
    clearError();
  }, [formData.role, clearError]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    clearError(); // Clear any previous errors

    const result = await login(formData.email, formData.password, formData.role);

    if (result.success) {
      // Show success toast
      setToast({ message: 'Login successful! Redirecting...', type: 'success' });

      // Redirect based on role after a short delay
      setTimeout(() => {
        const roleRoutes = {
          admin: '/admin/dashboard',
          principal: '/principal/dashboard',
          hod: '/hod/dashboard',
          faculty: '/class-management', // Redirect faculty to class management page
          student: '/student/dashboard'
        };
        navigate(roleRoutes[formData.role] || '/dashboard');
      }, 500);
    } else {
      // Show error toast with specific error message
      const errorMessage = result.error || error || 'Login failed. Please try again.';
      setToast({ message: errorMessage, type: 'error' });
    }

    setIsLoading(false);
  };

  const selectedRole = roles.find(role => role.value === formData.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-2 sm:p-4">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === 'error' ? 5000 : 3000}
        />
      )}

      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgb(59, 130, 246) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="w-full max-w-5xl mx-auto relative z-10">
        {/* Header Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 border-t-4 border-blue-600">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src="/pmc-logo.png"
                alt="PMC Tech Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none' }} className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
            </div>

            {/* College Info */}
            <div className="text-center">
              <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 leading-tight">
                ER.PERUMAL MANIMEKALAI COLLEGE OF ENGINEERING
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 font-semibold mb-2 sm:mb-3 tracking-wide">(AN AUTONOMOUS INSTITUTION)</p>
              <div className="flex items-center justify-center gap-1 sm:gap-2 text-blue-600">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs sm:text-sm font-semibold">Attendance Management System</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-200">
          {/* Role Selector */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-semibold text-gray-800 mb-3 sm:mb-4">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
              {roles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, role: role.value })}
                  className={`p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl text-center transition-all duration-200 h-14 sm:h-16 md:h-20 border-2 flex items-center justify-center ${formData.role === role.value
                      ? `${role.bgColor} ${role.textColor} border-current shadow-lg transform scale-105`
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:shadow-md'
                    }`}
                >
                  <div className="text-xs sm:text-sm font-bold">{role.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Role Display */}
          {selectedRole && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl bg-gradient-to-r ${selectedRole.color} text-white shadow-lg`}>
              <div className="flex items-center">
                <div className="mr-2 sm:mr-3 md:mr-4 p-2 sm:p-3 bg-white bg-opacity-20 rounded-lg">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Signing in as {selectedRole.label}</h3>
                  <p className="text-xs sm:text-sm opacity-90">Access your {selectedRole.label.toLowerCase()} dashboard</p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm sm:text-base"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 pr-10 sm:pr-12 text-sm sm:text-base"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">Remember me</span>
              </label>
              <a href="#" className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 sm:py-4 px-4 rounded-lg font-bold text-white transition-all duration-200 text-sm sm:text-base ${isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${selectedRole?.color || 'from-blue-500 to-purple-500'} hover:shadow-xl transform hover:scale-[1.02] active:scale-100`
                }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <span>SIGN IN</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

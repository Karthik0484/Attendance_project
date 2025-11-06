import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RestrictedHODDashboard from '../pages/dashboards/RestrictedHODDashboard';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking authentication
  // This prevents white screen flicker
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect if loading is complete and user is not authenticated
  // This prevents infinite redirect loops
  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If still loading or no user, don't render children yet
  // This prevents white screen flash
  if (!user) {
    return null;
  }

  // Redirect inactive HODs to restricted dashboard
  if (user.role === 'hod' && user.status === 'inactive' && location.pathname !== '/hod/dashboard/restricted') {
    // Check if trying to access HOD routes
    if (location.pathname.startsWith('/hod/')) {
      return <Navigate to="/hod/dashboard/restricted" replace />;
    }
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required roles: {allowedRoles.join(', ')}<br />
            Your role: {user.role}
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import PrincipalDashboard from './pages/dashboards/PrincipalDashboard';
import HODDashboard from './pages/dashboards/HODDashboard';
import FacultyDashboard from './pages/dashboards/FacultyDashboard';
import ClassAttendanceManagement from './pages/ClassAttendanceManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import StudentDashboard from './pages/dashboards/StudentDashboard';
import SemesterDetailPage from './pages/SemesterDetailPage';
import StudentReportsPage from './pages/StudentReportsPage';
import ClassManagementPage from './pages/ClassManagementPage';
import ClassSelectionPage from './pages/ClassSelectionPage';
import AssignedBatchesPage from './pages/AssignedBatchesPage';
import StudentManagementPage from './pages/StudentManagementPage';
import EnhancedStudentProfile from './components/EnhancedStudentProfile';
import StudentProfile from './components/StudentProfile';
import StudentProfileDetail from './components/StudentProfileDetail';
import ReportGeneration from './components/ReportGeneration';
import FixAssignmentsPage from './pages/FixAssignmentsPage';
import './App.css';

// Wrapper component to add unique keys to routes
const AppRoutes = () => {
  const location = useLocation();
  
  return (
    <Routes location={location} key={location.pathname}>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/principal/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['principal']}>
                  <PrincipalDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hod/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['hod']}>
                  <HODDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hod/student-reports" 
              element={
                <ProtectedRoute allowedRoles={['hod', 'admin', 'principal']}>
                  <StudentReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/fix-assignments" 
              element={
                <ProtectedRoute allowedRoles={['hod', 'admin']}>
                  <FixAssignmentsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['faculty']}>
                  <FacultyDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/faculty/class/:classId" 
              element={
                <ProtectedRoute allowedRoles={['faculty']}>
                  <ClassAttendanceManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/attendance-management" 
              element={
                <ProtectedRoute allowedRoles={['faculty']}>
                  <AttendanceManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/semester/:semesterId" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <SemesterDetailPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/class-management" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ClassManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/class-management/:classId" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ClassManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/class-selection" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ClassSelectionPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/assigned-batches" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <AssignedBatchesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student-management" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <StudentManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student-profile/:studentId" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin', 'student']}>
                  <StudentProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/students/:id" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin', 'student']}>
                  <EnhancedStudentProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student-detail/:studentId" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <StudentProfileDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/report-generation" 
              element={
                <ProtectedRoute allowedRoles={['faculty', 'hod', 'principal', 'admin']}>
                  <ReportGeneration />
                </ProtectedRoute>
              } 
            />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <ClassProvider>
        <Router>
          <ScrollToTop />
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </ClassProvider>
    </AuthProvider>
  );
}

export default App;

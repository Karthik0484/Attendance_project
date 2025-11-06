import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/config.js';

// Generate JWT tokens
export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '15m'
  });
  
  const refreshToken = jwt.sign({ id: userId }, config.JWT_SECRET, {
    expiresIn: '7d'
  });
  
  return { accessToken, refreshToken };
};

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    console.log('🔐 Auth middleware - Token exists:', !!token);
    console.log('🔐 Auth middleware - Authorization header:', req.headers.authorization?.substring(0, 20) + '...');

    if (!token) {
      console.log('❌ Auth middleware - No token provided');
      return res.status(401).json({ 
        success: false,
        msg: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    console.log('🔐 Auth middleware - Token decoded:', { id: decoded.id, role: decoded.role });
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('❌ Auth middleware - User not found for ID:', decoded.id);
      return res.status(401).json({ 
        success: false,
        msg: 'Token is not valid. User not found.' 
      });
    }

    console.log('✅ Auth middleware - User found:', { id: user._id, role: user.role, department: user.department, status: user.status, accessLevel: user.accessLevel });

    // Check if account is suspended (completely blocked)
    if (user.status === 'suspended') {
      console.log('❌ Auth middleware - User account suspended');
      return res.status(403).json({ 
        success: false,
        msg: 'Account is suspended. Please contact administrator.' 
      });
    }

    // Check if HOD account is expired
    if (user.role === 'hod' && user.expiryDate) {
      const isExpired = new Date() > new Date(user.expiryDate);
      if (isExpired) {
        console.log('❌ Auth middleware - HOD account expired');
        return res.status(403).json({ 
          success: false,
          msg: 'Your HOD access has expired. Please contact administrator.' 
        });
      }
    }

    // For non-HOD roles, only allow active status
    if (user.role !== 'hod' && user.status !== 'active') {
      console.log('❌ Auth middleware - Non-HOD user account inactive:', user.status);
      return res.status(401).json({ 
        success: false,
        msg: 'Account is inactive. Please contact administrator.' 
      });
    }

    // For HODs, inactive status is allowed but with restricted access
    // This is handled by accessLevel, not by blocking authentication

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Attach access level info to user object
    req.user = user;
    req.user.isRestricted = user.role === 'hod' && user.status === 'inactive';
    req.user.hasFullAccess = user.accessLevel === 'full' || (user.role === 'hod' && user.status === 'active');
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        msg: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        msg: 'Token expired.' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      msg: 'Server error during authentication.' 
    });
  }
};

// Role-based authorization middleware
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    console.log('🔒 Authorization middleware - User:', req.user ? { role: req.user.role } : 'No user');
    console.log('🔒 Authorization middleware - Allowed roles:', allowedRoles);
    
    if (!req.user) {
      console.log('❌ Authorization middleware - No user found');
      return res.status(401).json({ 
        success: false,
        msg: 'Authentication required.' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Authorization middleware - Role not allowed:', req.user.role);
      return res.status(403).json({ 
        success: false,
        msg: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    console.log('✅ Authorization middleware - Access granted');
    next();
  };
};

// Admin only middleware
export const adminOnly = authorize('admin');

// Faculty and above middleware
export const facultyAndAbove = authorize('admin', 'principal', 'hod', 'faculty');

// HOD and above middleware (including faculty)
export const hodAndAbove = authorize('admin', 'principal', 'hod', 'faculty');

// Principal and above middleware
export const principalAndAbove = authorize('admin', 'principal');

// Department access middleware
export const departmentAccess = (req, res, next) => {
  const userDepartment = req.user.department;
  const requestedDepartment = req.params.department || req.body.department;

  if (req.user.role === 'admin' || req.user.role === 'principal') {
    return next(); // Admin and Principal can access all departments
  }

  if (userDepartment && requestedDepartment && userDepartment !== requestedDepartment) {
    return res.status(403).json({ 
      success: false,
      msg: 'Access denied. You can only access your department data.' 
    });
  }

  next();
};

// Self or admin access middleware
export const selfOrAdmin = (req, res, next) => {
  const userId = req.params.id || req.params.userId;
  
  if (req.user.role === 'admin' || req.user._id.toString() === userId) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false,
    msg: 'Access denied. You can only access your own data.' 
  });
};

// Restrict write operations for inactive HODs
export const restrictInactiveHOD = (req, res, next) => {
  // Check if this is a write operation (POST, PUT, DELETE, PATCH)
  const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (writeMethods.includes(req.method)) {
    // Check if user is an inactive HOD
    if (req.user && req.user.role === 'hod' && req.user.status === 'inactive') {
      console.log('🚫 Write operation blocked for inactive HOD:', req.user.email);
      return res.status(403).json({ 
        success: false,
        msg: 'Your HOD role is currently inactive. You can view data but cannot perform modifications. Please contact the Principal for reactivation.' 
      });
    }
    
    // Also check accessLevel
    if (req.user && req.user.role === 'hod' && req.user.accessLevel === 'restricted') {
      console.log('🚫 Write operation blocked for restricted HOD:', req.user.email);
      return res.status(403).json({ 
        success: false,
        msg: 'Your account has restricted access. You can view data but cannot perform modifications.' 
      });
    }
  }
  
  next();
};

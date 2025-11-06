import { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

// Set axios base URL (ensure no trailing slash)
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

const AuthContext = createContext();

const initialState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
  loading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'LOGIN_FAIL':
    case 'LOGOUT':
      // Clear tokens and authorization header
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    case 'UPDATE_TOKENS':
      localStorage.setItem('accessToken', action.payload.accessToken);
      // Update authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.accessToken}`;
      return {
        ...state,
        accessToken: action.payload.accessToken
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set axios default header
  useEffect(() => {
    if (state.accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [state.accessToken]);

  // Load user on app start - only run once
  // This prevents infinite redirects by properly handling loading state
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    const loadUser = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!accessToken) {
        // No token - user is not authenticated
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
        return;
      }

      try {
        console.log('🔐 Loading user with access token');
        
        // Set authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        const res = await axios.get(`${API_BASE_URL}/api/auth/me`);
        
        if (isMounted && res.data && res.data.user) {
          console.log('✅ User loaded successfully:', res.data.user);
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { 
              accessToken, 
              refreshToken, 
              user: res.data.user 
            }
          });
        }
      } catch (error) {
        console.error('❌ Error loading user:', error.response?.data || error.message);
        
        // Check if token is expired
        const errorMsg = error.response?.data?.msg || '';
        const isTokenExpired = error.response?.status === 401 && 
          (errorMsg.includes('expired') || errorMsg.includes('Token expired') || errorMsg === 'Token expired.');
        
        // Try to refresh token if access token expired
        if (isTokenExpired && refreshToken) {
          try {
            console.log('🔄 Attempting token refresh...');
            
            // Remove expired access token before refresh
            localStorage.removeItem('accessToken');
            delete axios.defaults.headers.common['Authorization'];
            
            const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
              refreshToken
            });
            
            if (refreshRes.data && refreshRes.data.accessToken) {
              const newAccessToken = refreshRes.data.accessToken;
              const newRefreshToken = refreshRes.data.refreshToken || refreshToken; // Use new refresh token if provided
              
              localStorage.setItem('accessToken', newAccessToken);
              if (refreshRes.data.refreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }
              axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              
              // Retry loading user with new token
              const userRes = await axios.get(`${API_BASE_URL}/api/auth/me`);
              
              if (isMounted && userRes.data && userRes.data.user) {
                dispatch({
                  type: 'LOGIN_SUCCESS',
                  payload: { 
                    accessToken: newAccessToken, 
                    refreshToken: newRefreshToken, 
                    user: userRes.data.user 
                  }
                });
                return;
              }
            }
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            // Clear all tokens if refresh fails
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            delete axios.defaults.headers.common['Authorization'];
            
            if (isMounted) {
              dispatch({ type: 'LOGOUT', payload: 'Session expired. Please login again.' });
            }
            return;
          }
        }
        
        // Authentication failed - clear tokens
        if (isMounted) {
          // Clear tokens if authentication fails
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          delete axios.defaults.headers.common['Authorization'];
          
          dispatch({ type: 'LOGOUT', payload: 'Authentication failed. Please login again.' });
        }
      }
    };

    loadUser();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const login = async (email, password, role) => {
    try {
      console.log('🔐 Frontend: Attempting login with:', { email, role });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Clear any existing expired tokens before login
      // This prevents issues with expired tokens from previous sessions
      const oldAccessToken = localStorage.getItem('accessToken');
      const oldRefreshToken = localStorage.getItem('refreshToken');
      
      if (oldAccessToken || oldRefreshToken) {
        console.log('🧹 Clearing old tokens before new login...');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete axios.defaults.headers.common['Authorization'];
      }
      
      const loginData = { 
        email: email.toLowerCase().trim(), 
        password, 
        role: role.toLowerCase().trim() 
      };
      
      console.log('📤 Frontend: Sending login request:', loginData);
      console.log('🔗 API Base URL:', API_BASE_URL);
      
      // Construct full URL to avoid double slash issues
      const loginUrl = `${API_BASE_URL}/api/auth/login`;
      console.log('🔗 Full Login URL:', loginUrl);
      
      const res = await axios.post(loginUrl, loginData);
      console.log('✅ Frontend: Login successful:', res.data);
      
      if (res.data.success) {
        // Store new tokens
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        
        // Set authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            user: res.data.user
          }
        });
      } else {
        throw new Error(res.data.msg || 'Login failed');
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Frontend: Login error:', error.response?.data || error.message);
      
      // Clear any tokens on login failure
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      
      // Handle specific error messages from backend
      let message = 'Login failed';
      
      if (error.response?.data?.msg) {
        message = error.response.data.msg;
      } else if (error.response?.status === 401) {
        message = 'Invalid credentials';
      } else if (error.response?.status === 400) {
        message = 'Validation failed. Please check your input.';
      } else if (error.response?.status === 500) {
        message = 'Server error. Please try again.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        message = 'Network error. Please check your connection.';
      }
      
      console.log('📝 Frontend: Error message to display:', message);
      
      dispatch({ type: 'LOGIN_FAIL', payload: message });
      return { success: false, error: message };
    }
  };

  const logout = () => {
    // Clear tokens and authorization header
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    
    dispatch({ type: 'LOGOUT', payload: null });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


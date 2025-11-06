// API Configuration
// In production, this will use the deployed backend URL
// In development, it will use localhost (or Vite proxy)

const getApiBaseUrl = () => {
  // Check if we're in production (built app)
  if (import.meta.env.PROD) {
    // Use environment variable if set, otherwise use deployed backend
    return import.meta.env.VITE_API_URL || 'https://attendance-project-74sp.onrender.com';
  }
  
  // In development, use localhost (Vite proxy will handle it)
  // Or use environment variable if set
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();

// Log the API URL in development for debugging
if (import.meta.env.DEV) {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

export default {
  API_BASE_URL
};


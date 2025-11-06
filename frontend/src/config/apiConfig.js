// API Configuration
// In production, uses VITE_API_URL environment variable (set in Vercel)
// In development, uses localhost:5000

const getApiBaseUrl = () => {
  // Check if we're in production (built app)
  if (import.meta.env.PROD) {
    // Use VITE_API_URL from environment (set in Vercel)
    // Fallback to deployed backend URL if not set
    return import.meta.env.VITE_API_URL || 'https://attendance-project-74sp.onrender.com';
  }
  
  // In development, always use localhost
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();

// Log the API URL for debugging
console.log('🔗 API Base URL:', API_BASE_URL, '(Mode:', import.meta.env.MODE + ')');

export default {
  API_BASE_URL
};


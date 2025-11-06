// API Configuration
// In production, uses VITE_API_URL environment variable (set in Vercel)
// In development, uses localhost:5000
// Note: For Vite, use VITE_API_URL (not NEXT_PUBLIC_API_URL which is for Next.js)

const getApiBaseUrl = () => {
  // Check if we're in production (built app)
  if (import.meta.env.PROD) {
    // Use VITE_API_URL from environment (set in Vercel)
    // Fallback to deployed backend URL if not set
    const envUrl = import.meta.env.VITE_API_URL || 'https://attendance-project-74sp.onrender.com';
    // Remove trailing slash to prevent double slashes
    return envUrl.replace(/\/+$/, '');
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


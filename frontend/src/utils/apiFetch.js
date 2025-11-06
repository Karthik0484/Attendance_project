import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

// Ensure axios uses the correct base URL
if (!axios.defaults.baseURL) {
  axios.defaults.baseURL = API_BASE_URL;
}

// Helper function to get full API URL
export const getApiUrl = (path) => {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};

export const apiFetch = async (options) => {
  const {
    url,
    method = 'GET',
    data,
    params,
    headers = {},
    responseType = 'json'
  } = options;

  // Automatically add Authorization header if access token exists
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    // Ensure URL is absolute (prepend API_BASE_URL if relative)
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
    const res = await axios({ url: fullUrl, method, data, params, headers, responseType });
    return res;
  } catch (error) {
    // If unauthorized, try refresh flow
    const status = error?.response?.status;
    if (status === 401 && localStorage.getItem('refreshToken')) {
      try {
        const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken: localStorage.getItem('refreshToken') });
        const newAccess = refreshRes.data?.accessToken;
        if (newAccess) {
          localStorage.setItem('accessToken', newAccess);
          axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
          // Update headers with new token before retry
          headers.Authorization = `Bearer ${newAccess}`;
          // retry with updated headers
          const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
          const retry = await axios({ url: fullUrl, method, data, params, headers, responseType });
          return retry;
        }
      } catch (e) {
        // If refresh fails, just throw the original error
        console.error('Token refresh failed:', e);
      }
    }
    throw error;
  }
};





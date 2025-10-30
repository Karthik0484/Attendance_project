import axios from 'axios';

// Axios base is already set in AuthContext to http://localhost:5000

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
    const res = await axios({ url, method, data, params, headers, responseType });
    return res;
  } catch (error) {
    // If unauthorized, try refresh flow
    const status = error?.response?.status;
    if (status === 401 && localStorage.getItem('refreshToken')) {
      try {
        const refreshRes = await axios.post('/api/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') });
        const newAccess = refreshRes.data?.accessToken;
        if (newAccess) {
          localStorage.setItem('accessToken', newAccess);
          axios.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
          // Update headers with new token before retry
          headers.Authorization = `Bearer ${newAccess}`;
          // retry with updated headers
          const retry = await axios({ url, method, data, params, headers, responseType });
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





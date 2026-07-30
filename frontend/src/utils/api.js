import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Single-flight token refresh: when multiple requests get 401 simultaneously,
// only the first triggers a refresh. All others queue up and replay with the
// new token once the single refresh completes. This prevents race conditions
// where multiple concurrent refresh calls invalidate each other.
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token);
  });
  failedQueue = [];
};

const clearAuthAndRedirect = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const normalizedUrl = (config.url || '').replace(/^\//, '');

    if (normalizedUrl === 'users/login/') {
      return config;
    }

    // Don't override an Authorization header already set (e.g. temp_token for change-password)
    if (config.headers.Authorization) {
      return config;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If it was a login attempt that failed, don't retry, just fail
      if (originalRequest.url === 'users/login/') {
        return Promise.reject(error);
      }

      // If a refresh is already in progress, queue this request to wait on it
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // SimpleJWT's TokenRefreshView returns { access } only — no refresh token rotation.
        const response = await axios.post(`${API_BASE_URL}users/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);
        // If backend ever rotates refresh tokens, store the new one here:
        // if (response.data.refresh) {
        //   localStorage.setItem('refresh_token', response.data.refresh);
        // }

        // Release all queued requests with the new token
        processQueue(null, access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear auth state and redirect to login exactly once
        processQueue(refreshError);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

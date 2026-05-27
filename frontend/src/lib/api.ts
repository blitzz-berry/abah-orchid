import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _stepUpRetry?: boolean;
};

let accessToken: string | null = null;
const AUTH_REFRESH_EXCLUDED_PATHS = new Set([
  '/auth/login',
  '/auth/google',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function shouldUseSameOriginProxy(configuredURL?: string) {
  if (typeof window === 'undefined') return false;
  if (isLoopbackHost(window.location.hostname) || window.location.port === '3000') return false;
  if (!configuredURL) return true;
  try {
    const parsed = new URL(configuredURL);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function getAPIBaseURL() {
  const configuredURL = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return configuredURL || 'http://localhost:8080/api/v1';
  if (shouldUseSameOriginProxy(configuredURL)) return '/api/v1';
  if (configuredURL) return configuredURL;
  if (window.location.port === '3000') return 'http://localhost:8080/api/v1';
  return '/api/v1';
}

function normalizeRequestPath(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url.startsWith('/') ? url : `/${url}`;
}

function shouldSkipRefresh(url?: string) {
  return AUTH_REFRESH_EXCLUDED_PATHS.has(normalizeRequestPath(url));
}

export function setAccessToken(token: string | null | undefined) {
	accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

const api = axios.create({
  baseURL: getAPIBaseURL(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const method = (config.method || 'get').toLowerCase();
  const isAdminMutation = /^\/?admin(?:\/|$)/.test(config.url || '') && ['post', 'put', 'patch', 'delete'].includes(method);
  if (isAdminMutation) {
    config.headers['X-Admin-Step-Up'] = 'confirm';
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const needsFreshAdminToken =
      error.response?.status === 403 &&
      error.response?.data?.code === 'admin_step_up_required' &&
      originalRequest &&
      !originalRequest._stepUpRetry &&
      originalRequest.url !== '/auth/refresh' &&
      typeof window !== 'undefined';

    if (
      (error.response?.status === 401 || needsFreshAdminToken) &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      !shouldSkipRefresh(originalRequest.url) &&
      typeof window !== 'undefined'
    ) {
      originalRequest._retry = true;
      if (needsFreshAdminToken) originalRequest._stepUpRetry = true;
      try {
        const response = await api.post('/auth/refresh');
        const data = response.data.data || response.data;
        if (!data.access_token) throw new Error('Missing access token');
        setAccessToken(data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        clearLegacyAuthStorage();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

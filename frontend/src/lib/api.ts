import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let accessToken: string | null = null;

export function setAccessToken(token: string | null | undefined) {
  accessToken = token || null;
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
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      typeof window !== 'undefined'
    ) {
      originalRequest._retry = true;
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

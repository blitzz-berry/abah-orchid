import { create } from 'zustand';
import api, { clearAccessToken, clearLegacyAuthStorage, setAccessToken } from '@/lib/api';
import type { User } from '@/types';

const AUTH_SESSION_HINT_KEY = 'orchidmart_auth_session';

function hasBrowserStorage() {
  return typeof window !== 'undefined';
}

function hasAuthSessionHint() {
  if (!hasBrowserStorage()) return false;
  return localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
}

function setAuthSessionHint() {
  if (!hasBrowserStorage()) return;
  localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
}

function clearAuthSessionHint() {
  if (!hasBrowserStorage()) return;
  localStorage.removeItem(AUTH_SESSION_HINT_KEY);
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User, token?: string) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  login: (user, token) => {
    if (token) setAccessToken(token);
    setAuthSessionHint();
    clearLegacyAuthStorage();
    set({ user, isAuthenticated: true });
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      void 0;
    }
    clearAccessToken();
    clearAuthSessionHint();
    clearLegacyAuthStorage();
    set({ user: null, isAuthenticated: false, isHydrated: true });
  },
  hydrate: async () => {
    clearLegacyAuthStorage();
    if (!hasAuthSessionHint()) {
      clearAccessToken();
      set({ user: null, isAuthenticated: false, isHydrated: true });
      return;
    }
    try {
      const response = await api.post('/auth/refresh');
      const data = response.data.data || response.data;
      if (!data.access_token || !data.user) throw new Error('Incomplete auth response');
      setAccessToken(data.access_token);
      setAuthSessionHint();
      set({ user: data.user as User, isAuthenticated: true, isHydrated: true });
    } catch {
      clearAccessToken();
      clearAuthSessionHint();
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },
}));

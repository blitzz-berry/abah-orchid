import { create } from 'zustand';
import api, { clearAccessToken, clearLegacyAuthStorage, setAccessToken } from '@/lib/api';
import type { User } from '@/types';

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
    clearLegacyAuthStorage();
    set({ user: null, isAuthenticated: false, isHydrated: true });
  },
  hydrate: async () => {
    clearLegacyAuthStorage();
    try {
      const response = await api.post('/auth/refresh');
      const data = response.data.data || response.data;
      if (!data.access_token || !data.user) throw new Error('Incomplete auth response');
      setAccessToken(data.access_token);
      set({ user: data.user as User, isAuthenticated: true, isHydrated: true });
    } catch {
      clearAccessToken();
      set({ user: null, isAuthenticated: false, isHydrated: true });
    }
  },
}));

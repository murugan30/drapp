'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

export type UserRole = 'admin' | 'doctor' | 'assistant' | 'lab' | 'patient';

export type AuthUser = {
  id: string;
  role: UserRole;
  mobile: string;
  preferredLocale?: 'en' | 'ta';
  name?: string;
  slotMinutes?: number;
};

type RequestOtpResponse = {
  success: boolean;
  otp?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loginStaff: (mobile: string, password: string) => Promise<void>;
  requestOtp: (mobile: string) => Promise<RequestOtpResponse>;
  verifyOtp: (mobile: string, code: string) => Promise<AuthUser>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch<AuthUser>('/auth/me');
      if (me.preferredLocale) {
        document.cookie = `locale=${me.preferredLocale}; path=/; max-age=31536000`;
      }
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loginStaff = useCallback(async (mobile: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
      '/auth/staff/login',
      {
        method: 'POST',
        body: JSON.stringify({ mobile, password }),
      },
    );
    if (res.user.preferredLocale) {
      document.cookie = `locale=${res.user.preferredLocale}; path=/; max-age=31536000`;
    }
    setUser(res.user);
  }, []);

  const requestOtp = useCallback(async (mobile: string) => {
    return await apiFetch<RequestOtpResponse>('/auth/patient/request-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  }, []);

  const verifyOtp = useCallback(async (mobile: string, code: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
      '/auth/patient/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ mobile, code }),
      },
    );
    if (res.user.preferredLocale) {
      document.cookie = `locale=${res.user.preferredLocale}; path=/; max-age=31536000`;
    }
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginStaff, requestOtp, verifyOtp, refresh: hydrate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

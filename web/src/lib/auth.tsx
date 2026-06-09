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

type RequestPasswordResetOtpResponse = {
  success: boolean;
  otp?: string;
};

type RegisterPatientPayload = {
  mobile: string;
  password: string;
  fullName: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  relationship?: string;
  phone?: string;
  notes?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<AuthUser>;
  registerPatient: (payload: RegisterPatientPayload) => Promise<AuthUser>;
  requestPasswordResetOtp: (mobile: string) => Promise<RequestPasswordResetOtpResponse>;
  confirmPasswordReset: (mobile: string, code: string, newPassword: string) => Promise<void>;
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

  const login = useCallback(async (mobile: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ mobile, password }),
      },
    );
    if (res.user.preferredLocale) {
      document.cookie = `locale=${res.user.preferredLocale}; path=/; max-age=31536000`;
    }
    setUser(res.user);
    return res.user;
  }, []);

  const registerPatient = useCallback(async (payload: RegisterPatientPayload) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>('/auth/patient/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.user.preferredLocale) {
      document.cookie = `locale=${res.user.preferredLocale}; path=/; max-age=31536000`;
    }
    setUser(res.user);
    return res.user;
  }, []);

  const requestPasswordResetOtp = useCallback(async (mobile: string) => {
    return await apiFetch<RequestPasswordResetOtpResponse>('/auth/password-reset/request-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  }, []);

  const confirmPasswordReset = useCallback(async (mobile: string, code: string, newPassword: string) => {
    await apiFetch('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ mobile, code, newPassword }),
    });
  }, []);

  const logout = useCallback(() => {
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, registerPatient, requestPasswordResetOtp, confirmPasswordReset, refresh: hydrate, logout }}>
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

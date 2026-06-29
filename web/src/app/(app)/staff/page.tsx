'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';
import styles from './staff.module.css';

type StaffUser = {
  _id: string;
  mobile: string;
  role: 'admin' | 'doctor' | 'assistant' | 'lab' | 'patient';
  name?: string;
  email?: string;
  isActive?: boolean;
  createdAt?: string;
};

type CreateStaffPayload = {
  mobile: string;
  role: 'doctor' | 'assistant' | 'lab';
  password: string;
  name?: string;
  email?: string;
};

export default function StaffPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<'doctor' | 'assistant' | 'lab'>('doctor');
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateStaffPayload>({
    mobile: '',
    role: 'doctor',
    password: '',
    name: '',
    email: '',
  });

  const canView = user?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    if (!canView) {
      router.push('/dashboard');
    }
  }, [canView, router, user]);

  const activeRole = tab;

  const title = useMemo(() => {
    if (activeRole === 'doctor') return 'Doctors';
    if (activeRole === 'assistant') return 'Assistants';
    return 'Lab';
  }, [activeRole]);

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<StaffUser[]>(`/users?role=${activeRole}`);
      setStaff(res || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    setForm((prev) => ({ ...prev, role: activeRole }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, canView]);

  const createStaff = async () => {
    setError(null);
    const payload: CreateStaffPayload = {
      mobile: form.mobile.trim(),
      role: form.role,
      password: form.password,
      name: form.name?.trim() || undefined,
      email: form.email?.trim() || undefined,
    };

    if (!payload.mobile || payload.mobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (!payload.password || payload.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
      setForm({ mobile: '', role: activeRole, password: '', name: '', email: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create staff');
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'doctor' ? styles.tabActive : ''}`}
          onClick={() => setTab('doctor')}
          type="button"
        >
          Doctors
        </button>
        <button
          className={`${styles.tab} ${tab === 'assistant' ? styles.tabActive : ''}`}
          onClick={() => setTab('assistant')}
          type="button"
        >
          Assistants
        </button>
        <button
          className={`${styles.tab} ${tab === 'lab' ? styles.tabActive : ''}`}
          onClick={() => setTab('lab')}
          type="button"
        >
          Lab
        </button>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Create {activeRole === 'lab' ? 'Lab user' : title.slice(0, -1)}</h3>
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Mobile
              <input
                className={styles.input}
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              />
            </label>

            <label className={styles.label}>
              Password
              <input
                className={styles.input}
                type="password"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>

            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                placeholder="Optional"
                value={form.name || ''}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>

            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                placeholder="Optional"
                value={form.email || ''}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>

            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={createStaff} disabled={loading}>
                Create
              </button>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h3 className={styles.cardTitle}>{title}</h3>
            <button className={styles.buttonGhost} type="button" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading ? <p className={styles.textMuted}>Loading…</p> : null}

          {staff.length === 0 && !loading ? (
            <p className={styles.textMuted}>No {title.toLowerCase()} created yet.</p>
          ) : (
            <div className={styles.list}>
              {staff.map((s) => (
                <div key={s._id} className={styles.listRow}>
                  <div>
                    <div className={styles.listTitle}>{s.name || s.mobile}</div>
                    <div className={styles.textMuted}>{s.mobile}</div>
                  </div>
                  <div className={styles.pill}>{s.isActive === false ? 'Inactive' : s.role.toUpperCase()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

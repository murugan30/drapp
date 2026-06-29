'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';
import styles from './settings.module.css';

export default function SettingsPage() {
  const t = useTranslations();
  const { user, refresh } = useAuth();
  const [slotMinutes, setSlotMinutes] = useState<number>(15);
  const [saving, setSaving] = useState(false);

  const canSetSlotMinutes = user?.role === 'doctor' || user?.role === 'admin';

  useEffect(() => {
    if (!user) return;
    if (typeof user.slotMinutes === 'number') {
      setSlotMinutes(user.slotMinutes);
    }
  }, [user]);

  const saveSlotMinutes = async () => {
    if (!canSetSlotMinutes) return;
    setSaving(true);
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ doctorProfile: { slotMinutes } }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.gridTwo}>
        <div className={styles.card}>
          <h3>Profile</h3>
          <p className={styles.textMuted}>Mobile: {user?.mobile}</p>
          <p>Role: {user?.role}</p>
        </div>
        <div className={styles.card}>
          <h3>Security</h3>
          <p className={styles.textMuted}>Tokens expire every 8 hours.</p>
          <p>OTP retry limit: 5 attempts.</p>
        </div>
        {canSetSlotMinutes ? (
          <div className={styles.card}>
            <h3>Availability</h3>
            <p className={styles.textMuted}>Default appointment slot length.</p>
            <div className={styles.inlineRow}>
              <input
                className={styles.input}
                type="number"
                min={5}
                max={60}
                step={5}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value || 15))}
              />
              <span className={styles.textMuted}>minutes</span>
              <button className={styles.button} type="button" onClick={saveSlotMinutes} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

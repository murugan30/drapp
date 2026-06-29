'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';
import styles from './LocaleSwitcher.module.css';

export function LocaleSwitcher() {
  const router = useRouter();
  const { user } = useAuth();
  const [current, setCurrent] = useState<'en' | 'ta'>('en');

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )locale=([^;]+)/);
    setCurrent(match?.[1] === 'ta' ? 'ta' : 'en');
  }, []);

  const handleChange = async (locale: 'en' | 'ta') => {
    if (locale === current) return;
    setCurrent(locale);
    document.cookie = `locale=${locale}; path=/; max-age=31536000`;
    if (user) {
      try {
        await apiFetch('/users/me/locale', {
          method: 'PATCH',
          body: JSON.stringify({ preferredLocale: locale }),
        });
      } catch {
        // ignore for now
      }
    }
    router.refresh();
  };

  return (
    <div className={styles.switcher} role="group" aria-label="Select language">
      <div className={styles.switcherIcon} aria-hidden="true">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </div>
      <button
        className={`${styles.chip} ${current === 'en' ? styles.chipActive : ''}`}
        onClick={() => handleChange('en')}
        aria-pressed={current === 'en'}
        type="button"
      >
        English
      </button>
      <button
        className={`${styles.chip} ${current === 'ta' ? styles.chipActive : ''}`}
        onClick={() => handleChange('ta')}
        aria-pressed={current === 'ta'}
        type="button"
      >
        தமிழ்
      </button>
    </div>
  );
}

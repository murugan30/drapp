'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiFetch } from '../lib/api';
import styles from './LocaleSwitcher.module.css';

export function LocaleSwitcher() {
  const router = useRouter();
  const { user } = useAuth();

  const handleChange = async (locale: 'en' | 'ta') => {
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
    <div className={styles.switcher}>
      <button className={styles.chip} onClick={() => handleChange('en')}>
        EN
      </button>
      <button className={styles.chip} onClick={() => handleChange('ta')}>
        தமிழ்
      </button>
    </div>
  );
}

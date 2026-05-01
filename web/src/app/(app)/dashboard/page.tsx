'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { useOfflineStatus } from '../../../lib/offline';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const offline = useOfflineStatus();

  useEffect(() => {
    if (user?.role === 'patient') {
      router.replace('/home');
    }
  }, [router, user?.role]);

  if (user?.role === 'patient') {
    return null;
  }

  const roleLabel = user?.role?.toUpperCase() || 'GUEST';
  const name = user?.name;

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.badgeRow}>
            <p className={styles.badge}>{roleLabel}</p>
            {offline ? (
              <div className={styles.offlinePill}>
                <span className={styles.offlineDot} />
                {t('offline')}
              </div>
            ) : null}
          </div>
          <h2 className={styles.title}>
            {t('welcome')}
            {name ? `, ${name}` : ''}
          </h2>
          <p className={styles.subtitle}>Your clinic workspace at a glance.</p>
        </div>

        <div className={styles.quickLinks}>
          <Link className={styles.linkPill} href="/patients">
            {t('patients')}
          </Link>
          <Link className={styles.linkPill} href="/appointments">
            {t('appointments')}
          </Link>
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.cardHero}>
          <div>
            <h3 className={styles.cardTitle}>{t('today')}</h3>
            <p className={styles.textMuted}>Upcoming appointments and priorities.</p>
          </div>

          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Appointments</p>
              <div className={styles.statValue}>12</div>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>Reports pending</p>
              <div className={styles.statValue}>4</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{t('schedule')}</h3>
          <p className={styles.textMuted}>Set your availability and manage patient flow for the week.</p>
          <div className={styles.actionRow}>
            <Link className={styles.button} href="/settings">
              {t('availability')}
            </Link>
            <Link className={styles.buttonGhost} href="/appointments">
              {t('appointments')}
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.gridThree}>
        <Link className={styles.cardLink} href="/patients">
          <div className={styles.cardTitle}>{t('patients')}</div>
          <p className={styles.textMuted}>Quick access to profiles and history.</p>
          <div className={styles.cardAction}>{t('addPatient')}</div>
        </Link>

        <Link className={styles.cardLink} href="/appointments">
          <div className={styles.cardTitle}>{t('appointments')}</div>
          <p className={styles.textMuted}>Review today’s schedule and requests.</p>
          <div className={styles.cardAction}>{t('today')}</div>
        </Link>

        <Link className={styles.cardLink} href="/documents">
          <div className={styles.cardTitle}>{t('documents')}</div>
          <p className={styles.textMuted}>Upload and share reports securely.</p>
          <div className={styles.cardAction}>Upload</div>
        </Link>
      </div>
    </div>
  );
}

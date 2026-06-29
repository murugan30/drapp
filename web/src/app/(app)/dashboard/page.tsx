'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { useOfflineStatus } from '../../../lib/offline';
import { apiFetch } from '../../../lib/api';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();
  const offline = useOfflineStatus();

  const [todayCount, setTodayCount] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'patient') {
      router.replace('/home');
    }
  }, [router, user?.role]);

  useEffect(() => {
    const role = user?.role;
    if (!user || (role !== 'doctor' && role !== 'admin' && role !== 'assistant' && role !== 'lab')) return;

    const load = async () => {
      setLoadingStats(true);
      setStatsError(null);
      try {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayIso = `${y}-${m}-${d}`;

        if (role === 'doctor') {
          const appts = await apiFetch<any[]>(`/appointments/by-doctor?doctorId=${user.id}&date=${todayIso}`);
          const list = appts || [];
          setTodayCount(list.length);
          setTodayAppointments(list.slice(0, 5));
        }

        const patientsRes = await apiFetch<{ items: any[]; total: number; page: number; limit: number }>(
          '/patients?page=1&limit=1',
        );
        setTotalPatients(Number(patientsRes?.total || 0));
      } catch (e: any) {
        setStatsError(e?.message || 'Failed to load dashboard stats');
      } finally {
        setLoadingStats(false);
      }
    };

    void load();
  }, [user]);

  if (user?.role === 'patient') {
    return null;
  }

  const roleLabel = user?.role?.toUpperCase() || 'GUEST';
  const name = user?.name;
  const isDoctor = user?.role === 'doctor';
  const isStaff = user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'lab';

  const appointmentTime = (a: any) => {
    const date = new Date(a.scheduledAt);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const patientName = (a: any) => {
    return a.patientName || a.patient?.fullName || a.patient?.name || 'Patient';
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.hero}>
        <div className={styles.heroDecor} aria-hidden="true">
          <div className={styles.heroBlobOne} />
          <div className={styles.heroBlobTwo} />
          <div className={styles.heroGrid} />
        </div>

        <div className={styles.heroHeader}>
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
            <div className={styles.heroTitle}>
              {t('welcome')}
              {name ? `, ${name}` : ''}
            </div>
            <div className={styles.heroSubtitle}>Your clinic workspace at a glance.</div>
          </div>

          <div className={styles.heroRight}>
            <Link className={styles.heroCtaPrimary} href="/patients">
              <span className={styles.heroCtaIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </svg>
              </span>
              {t('addPatient')}
            </Link>
            <Link className={styles.heroCta} href="/appointments/staff-book">
              <span className={styles.heroCtaIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v3" />
                  <path d="M16 2v3" />
                  <path d="M3 9h18" />
                  <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                  <path d="M12 13v3l2 1" />
                </svg>
              </span>
              Book appointment
            </Link>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statsBar}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>Appointments</span>
                <span className={styles.kpiIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v3" />
                    <path d="M16 2v3" />
                    <path d="M3 9h18" />
                    <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                  </svg>
                </span>
              </div>
              <div className={styles.kpiBottom}>
                <div>
                  <div className={styles.kpiValue}>{isDoctor ? (loadingStats ? '—' : todayCount) : '—'}</div>
                  <div className={styles.kpiHint}>Today</div>
                </div>
                <div className={styles.kpiSpark} aria-hidden="true">
                  <span className={styles.kpiSparkFill} style={{ width: '72%' }} />
                </div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{t('patients')}</span>
                <span className={styles.kpiIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  </svg>
                </span>
              </div>
              <div className={styles.kpiBottom}>
                <div>
                  <div className={styles.kpiValue}>{loadingStats ? '—' : totalPatients}</div>
                  <div className={styles.kpiHint}>Total</div>
                </div>
                <div className={styles.kpiSpark} aria-hidden="true">
                  <span className={styles.kpiSparkFill} style={{ width: '54%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDoctor ? (
        <div className={styles.gridTwo}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Today’s Schedule</h3>
                <p className={styles.textMuted}>Your appointments for today.</p>
              </div>
              <Link className={styles.cardLink} href="/appointments">View all</Link>
            </div>

            {statsError ? (
              <div className={styles.errorText}>{statsError}</div>
            ) : loadingStats ? (
              <div className={styles.pulseList}>
                <div className={styles.pulseItem}>
                  <div className={styles.pulseDot} />
                  <div className={styles.pulseText}>Loading schedule…</div>
                </div>
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v3" />
                    <path d="M16 2v3" />
                    <path d="M3 9h18" />
                    <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                    <path d="M12 13v3l2 1" />
                  </svg>
                </div>
                <div className={styles.emptyTitle}>No appointments today</div>
                <div className={styles.emptySub}>Book a slot or update availability.</div>
              </div>
            ) : (
              <div className={styles.scheduleList}>
                {todayAppointments.map((a) => (
                  <div key={a._id} className={styles.scheduleItem}>
                    <div className={styles.scheduleTime}>{appointmentTime(a)}</div>
                    <div className={styles.scheduleBody}>
                      <div className={styles.scheduleName}>{patientName(a)}</div>
                      <div className={styles.scheduleStatus}>{a.status || 'Scheduled'}</div>
                    </div>
                    <Link className={styles.scheduleLink} href={`/appointments/consultation/${a._id}`}>
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className={styles.gridTwo}>
        <div className={styles.cardHero}>
          <div>
            <h3 className={styles.cardTitle}>{t('today')}</h3>
            <p className={styles.textMuted}>Quick overview of what needs attention.</p>
          </div>

          <div className={styles.pulseList}>
            <div className={styles.pulseItem}>
              <div className={styles.pulseDot} />
              <div className={styles.pulseText}>Review pending reports</div>
            </div>
            <div className={styles.pulseItem}>
              <div className={styles.pulseDot} />
              <div className={styles.pulseText}>Check upcoming appointments</div>
            </div>
            <div className={styles.pulseItem}>
              <div className={styles.pulseDot} />
              <div className={styles.pulseText}>Update availability for the week</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Quick actions</h3>
          <p className={styles.textMuted}>Common workflows for staff and administrators.</p>
          <div className={styles.actionGrid}>
            <Link className={styles.actionTilePrimary} href="/patients">
              <div className={styles.actionTileTop}>
                <span className={styles.actionTileIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    <path d="M19 8v6" />
                    <path d="M22 11h-6" />
                  </svg>
                </span>
                <span className={styles.actionTileArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
              <div className={styles.actionTileTitle}>{t('addPatient')}</div>
              <div className={styles.actionTileSub}>Create or find a profile</div>
            </Link>
            <Link className={styles.actionTile} href="/appointments/staff-book">
              <div className={styles.actionTileTop}>
                <span className={styles.actionTileIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v3" />
                    <path d="M16 2v3" />
                    <path d="M3 9h18" />
                    <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                    <path d="M12 13v3l2 1" />
                  </svg>
                </span>
                <span className={styles.actionTileArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
              <div className={styles.actionTileTitle}>Book appointment</div>
              <div className={styles.actionTileSub}>For any patient</div>
            </Link>
            <Link className={styles.actionTile} href="/documents">
              <div className={styles.actionTileTop}>
                <span className={styles.actionTileIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                    <path d="M12 13v6" />
                    <path d="M9.5 15.5 12 13l2.5 2.5" />
                  </svg>
                </span>
                <span className={styles.actionTileArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
              <div className={styles.actionTileTitle}>Upload document</div>
              <div className={styles.actionTileSub}>Reports & prescriptions</div>
            </Link>
            <Link className={styles.actionTile} href="/availability">
              <div className={styles.actionTileTop}>
                <span className={styles.actionTileIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v3" />
                    <path d="M16 2v3" />
                    <path d="M3 9h18" />
                    <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                    <path d="M9 14h6" />
                    <path d="M9 17h3" />
                  </svg>
                </span>
                <span className={styles.actionTileArrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
              <div className={styles.actionTileTitle}>{t('availability')}</div>
              <div className={styles.actionTileSub}>Slots for the week</div>
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

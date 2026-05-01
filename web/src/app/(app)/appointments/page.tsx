
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { cachedFetch } from '../../../lib/offline';
import { apiFetch } from '../../../lib/api';
import styles from './appointments.module.css';

type DoctorPublic = {
  id: string;
  name: string;
};

type Member = {
  _id: string;
  fullName: string;
};

type Appointment = {
  _id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  status?: string;
};

function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AppointmentsPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [offline, setOffline] = useState(false);

  const [staffBusyId, setStaffBusyId] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const [staffDate, setStaffDate] = useState<string>(() => localTodayIso());
  const [staffDoctorId, setStaffDoctorId] = useState<string>('');
  const [staffDoctors, setStaffDoctors] = useState<DoctorPublic[]>([]);
  const [patientNameById, setPatientNameById] = useState<Map<string, string>>(new Map());

  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast] = useState<Appointment[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);

  const refreshStaffAppts = async () => {
    if (!user) return;
    if (user.role !== 'doctor' && user.role !== 'admin') return;
    const doctorId = user.role === 'admin' ? staffDoctorId : user.id;
    if (!doctorId) return;

    const res = await cachedFetch<any[]>(
      `appointments-${doctorId}-${staffDate}`,
      `/appointments/by-doctor?doctorId=${doctorId}&date=${staffDate}`,
    );
    setAppointments(res.data || []);
    setOffline(res.offline);

    const ids = Array.from(new Set((res.data || []).map((a: any) => a.patientId).filter(Boolean)));
    if (ids.length === 0) {
      setPatientNameById(new Map());
      return;
    }
    try {
      const rows = await Promise.all(ids.map((id: string) => apiFetch<any>(`/patients/${id}`)));
      const map = new Map<string, string>();
      for (const p of rows) {
        if (p?._id) map.set(p._id, p.fullName || 'Member');
      }
      setPatientNameById(map);
    } catch {
      setPatientNameById(new Map());
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (user.role === 'doctor' || user.role === 'admin') {
        setStaffDoctorId(user.id);
        if (user.role === 'admin') {
          const docs = await apiFetch<DoctorPublic[]>('/users/doctors-public');
          setStaffDoctors(docs || []);
        }
      } else if (user.role === 'patient') {
        const docs = await apiFetch<DoctorPublic[]>('/users/doctors-public');
        setDoctors(docs || []);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    void refreshStaffAppts();
  }, [staffDate, staffDoctorId, user]);

  const handleStaffCancel = async (id: string) => {
    if (!user) return;
    if (user.role !== 'doctor' && user.role !== 'admin') return;
    if (!window.confirm('Cancel this appointment?')) return;
    setStaffError(null);
    setStaffBusyId(id);
    try {
      await apiFetch(`/appointments/${id}/cancel`, { method: 'PATCH' });
      await refreshStaffAppts();
    } catch (e: any) {
      setStaffError(e?.message || 'Failed to cancel appointment');
    } finally {
      setStaffBusyId(null);
    }
  };

  const handleStaffComplete = async (id: string) => {
    if (!user) return;
    if (user.role !== 'doctor' && user.role !== 'admin') return;
    if (!window.confirm('Mark this appointment as completed?')) return;
    setStaffError(null);
    setStaffBusyId(id);
    try {
      await apiFetch(`/appointments/${id}/complete`, { method: 'PATCH' });
      await refreshStaffAppts();
    } catch (e: any) {
      setStaffError(e?.message || 'Failed to complete appointment');
    } finally {
      setStaffBusyId(null);
    }
  };

  useEffect(() => {
    const loadUpcoming = async () => {
      if (!user || user.role !== 'patient') return;
      setLoadingUpcoming(true);
      try {
        const m = await apiFetch<Member[]>('/patients/my');
        setMembers(m || []);
        const now = Date.now();
        const lists = await Promise.all(
          (m || []).map((mem) => apiFetch<Appointment[]>(`/appointments/by-patient?patientId=${mem._id}`)),
        );
        const merged = lists.flat();
        const upcomingMerged = merged.filter((a) => new Date(a.scheduledAt).getTime() >= now);
        upcomingMerged.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        const pastMerged = merged.filter((a) => new Date(a.scheduledAt).getTime() < now);
        pastMerged.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
        setUpcoming(upcomingMerged);
        setPast(pastMerged);
      } catch {
        setMembers([]);
        setUpcoming([]);
        setPast([]);
      } finally {
        setLoadingUpcoming(false);
      }
    };
    void loadUpcoming();
  }, [user]);

  const refreshUpcoming = async () => {
    if (!user || user.role !== 'patient') return;
    setLoadingUpcoming(true);
    try {
      const m = await apiFetch<Member[]>('/patients/my');
      setMembers(m || []);
      const now = Date.now();
      const lists = await Promise.all(
        (m || []).map((mem) => apiFetch<Appointment[]>(`/appointments/by-patient?patientId=${mem._id}`)),
      );
      const merged = lists.flat();
      const upcomingMerged = merged.filter((a) => new Date(a.scheduledAt).getTime() >= now);
      upcomingMerged.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      const pastMerged = merged.filter((a) => new Date(a.scheduledAt).getTime() < now);
      pastMerged.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
      setUpcoming(upcomingMerged);
      setPast(pastMerged);
    } catch {
      void 0;
    } finally {
      setLoadingUpcoming(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!user || user.role !== 'patient') return;
    if (!window.confirm('Cancel this appointment?')) return;
    setCancelError(null);
    setCancellingId(id);
    try {
      await apiFetch(`/appointments/${id}/cancel`, { method: 'PATCH' });
      await refreshUpcoming();
    } catch (e: any) {
      setCancelError(e?.message || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };
  const doctorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctors) {
      map.set(d.id, d.name);
    }
    return map;
  }, [doctors]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m._id, m.fullName);
    }
    return map;
  }, [members]);

  const groupedUpcoming = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const appt of upcoming) {
      const d = new Date(appt.scheduledAt);
      const key = localDateKey(d);
      const arr = groups.get(key) || [];
      arr.push(appt);
      groups.set(key, arr);
    }
    const keys = Array.from(groups.keys()).sort();
    return keys.map((k) => ({
      key: k,
      items: (groups.get(k) || []).slice().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    }));
  }, [upcoming]);

  const formatStatusLabel = (statusRaw: string) => {
    const s = (statusRaw || '').toLowerCase();
    if (s === 'scheduled') return 'Scheduled';
    if (s === 'cancelled') return 'Cancelled';
    if (s === 'completed') return 'Completed';
    if (!s) return 'Scheduled';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div>
          <h2>{t('appointments')}</h2>
          {offline ? <p className={styles.textMuted}>{t('offline')}</p> : null}
        </div>
        {user?.role === 'admin' || user?.role === 'assistant' ? (
          <Link className={styles.button} href="/appointments/staff-book">
            Book for patient
          </Link>
        ) : user?.role === 'doctor' ? (
          <button className={styles.button} disabled>
            {t('schedule')}
          </button>
        ) : null}
      </div>

      {user?.role === 'patient' ? (
        <>
          <div className="relative overflow-hidden flex flex-col items-stretch gap-4 rounded-3xl bg-gradient-to-br from-[#0254b7] to-[#0142A5] p-5 sm:p-6 mt-2 shadow-[0_8px_24px_-8px_rgba(1,101,252,0.4)] sm:flex-row sm:items-center sm:justify-between">
            {/* Background glowing orb effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-10 rounded-full filter blur-[30px] translate-x-[20%] -translate-y-[20%]" />

            <div className="relative z-10">
              <div className="text-xl font-bold text-white leading-snug tracking-tight">
                Ready for your next checkup?
              </div>
              <div className="mt-1 text-sm font-medium text-blue-100 max-w-[280px]">
                Choose a specialist and pick an available slot.
              </div>
            </div>
            <Link className="relative z-10 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-white text-[#0254b7] rounded-2xl px-4 py-2.5 text-sm font-bold shadow-md transition-transform hover:scale-[1.02] active:scale-95" href="/appointments/book">
              Book now
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </div>

          <div className={styles.card}>
            <div className={styles.upcomingList}>
              <div className={styles.upcomingMeta}>Upcoming bookings</div>
              {loadingUpcoming ? (
                <div className={styles.textMuted}>Loading appointments...</div>
              ) : upcoming.length === 0 ? (
                <div className="text-gray-500 font-medium text-[14px] bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-200">No upcoming bookings.</div>
              ) : (
                upcoming.map((a) => {
                  const d = new Date(a.scheduledAt);
                  const dateLabel = d.toLocaleDateString();
                  const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const docName = doctorNameById.get(a.doctorId) || 'Doctor';
                  const docInitial = (docName?.trim?.()?.[0] || 'D').toUpperCase();
                  const memberName = memberNameById.get(a.patientId) || 'Member';
                  const status = a.status || 'scheduled';

                  const isCancelled = status === 'cancelled';
                  const isCompleted = status === 'completed';
                  const statusClass = isCancelled ? styles.pillDanger : isCompleted ? styles.pillSuccess : styles.pillMuted;
                  const dotClass = isCancelled ? styles.statusDotCancelled : isCompleted ? styles.statusDotCompleted : styles.statusDotCancelled;

                  return (
                    <div key={a._id} className={styles.apptCard}>
                      <div className={styles.apptLeft}>
                        <div className={styles.apptAvatar}>{docInitial}</div>
                        <div className={styles.apptInfo}>
                          <div className={styles.apptTitle}>{docName}</div>
                          <div className={styles.apptSub}>
                            {dateLabel} · {timeLabel} · {memberName}
                          </div>
                        </div>
                      </div>
                      <div className={styles.apptRight}>
                        <span className={statusClass}>
                          <span className={`${styles.statusDot} ${dotClass}`} />
                          {formatStatusLabel(status)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="h-px bg-gray-100 w-full my-6" />

            <div className={styles.upcomingList}>
              <div className={styles.upcomingMeta}>Past bookings</div>
              {cancelError ? <div className={styles.bannerError}>{cancelError}</div> : null}
              {loadingUpcoming ? (
                <div className={styles.textMuted}>Loading appointments...</div>
              ) : past.length === 0 ? (
                <div className={styles.textMuted}>No past bookings.</div>
              ) : (
                <>
                  {(showAllPast ? past : past.slice(0, 2)).map((a) => {
                    const d = new Date(a.scheduledAt);
                    const dateLabel = d.toLocaleDateString();
                    const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const docName = doctorNameById.get(a.doctorId) || 'Doctor';
                    const docInitial = (docName?.trim?.()?.[0] || 'D').toUpperCase();
                    const memberName = memberNameById.get(a.patientId) || 'Member';
                    const status = a.status || 'scheduled';

                    const isCancelled = status === 'cancelled';
                    const isCompleted = status === 'completed';
                    const statusClass = isCancelled ? styles.pillDanger : isCompleted ? styles.pillSuccess : styles.pillMuted;
                    const dotClass = isCancelled ? styles.statusDotCancelled : isCompleted ? styles.statusDotCompleted : styles.statusDotCancelled;

                    return (
                      <div key={a._id} className={styles.apptCard}>
                        <div className={styles.apptLeft}>
                          <div className={styles.apptAvatar}>{docInitial}</div>
                          <div className={styles.apptInfo}>
                            <div className={styles.apptTitle}>{docName}</div>
                            <div className={styles.apptSub}>
                              {dateLabel} · {timeLabel} · {memberName}
                            </div>
                          </div>
                        </div>
                        <div className={styles.apptRight}>
                          <span className={statusClass}>
                            <span className={`${styles.statusDot} ${dotClass}`} />
                            {formatStatusLabel(status)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {!showAllPast && past.length > 2 ? (
                    <button type="button" className={styles.buttonGhost} onClick={() => setShowAllPast(true)}>
                      Show more
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.controls}>
            {user?.role === 'admin' ? (
              <select
                className={styles.select}
                value={staffDoctorId}
                onChange={(e) => setStaffDoctorId(e.target.value)}
              >
                <option value="">Select doctor</option>
                {staffDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </>
      )}

      <div className={styles.grid}>
        {user?.role === 'doctor' || user?.role === 'admin' ? (
          <div className={styles.card}>
            <div className={styles.bookingHeader}>
              <div>
                <div className={styles.bookingTitle}>Bookings</div>
                <div className={styles.bookingSub}>Select date to view appointments</div>
              </div>
              {user?.role === 'admin' ? (
                <select
                  className={styles.select}
                  value={staffDoctorId}
                  onChange={(e) => setStaffDoctorId(e.target.value)}
                >
                  <option value="">Select doctor</option>
                  {staffDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className={styles.dateBar}>
              <div className={styles.dateStrip}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const base = new Date();
                  base.setHours(0, 0, 0, 0);
                  base.setDate(base.getDate() + i);
                  const y = base.getFullYear();
                  const m = String(base.getMonth() + 1).padStart(2, '0');
                  const day = String(base.getDate()).padStart(2, '0');
                  const iso = `${y}-${m}-${day}`;
                  const active = iso === staffDate;
                  const dow = base.toLocaleDateString(undefined, { weekday: 'short' });
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`${styles.dateChip} ${active ? styles.dateChipActive : ''}`}
                      onClick={() => setStaffDate(iso)}
                    >
                      <div className={styles.dateChipDow}>{dow}</div>
                      <div className={styles.dateChipDay}>{base.getDate()}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {appointments.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>No bookings</div>
                <div className={styles.emptySub}>
                  There are no appointments for {staffDate}. Try another date{user?.role === 'admin' ? ' or doctor' : ''}.
                </div>
              </div>
            ) : (
              <div className={styles.upcomingList}>
                {staffError ? <div className={styles.bannerError}>{staffError}</div> : null}
                {appointments.map((appt: any) => {
                  const d = new Date(appt.scheduledAt);
                  const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const patientLabel = patientNameById.get(appt.patientId) || appt.patientId;
                  const status = appt.status || 'scheduled';
                  const statusClass = status === 'scheduled' ? styles.pill : status === 'cancelled' ? styles.pillDanger : status === 'completed' ? styles.pillSuccess : styles.pillMuted;
                  const canAct = status === 'scheduled';
                  const busy = staffBusyId === appt._id;
                  return (
                    <div key={appt._id} className={styles.apptCard}>
                      <div className={styles.apptTimeCol}>
                        <div className={styles.apptTime}>{timeLabel}</div>
                        <div className={styles.apptDateSmall}>{staffDate}</div>
                      </div>
                      <div className={styles.apptDetails}>
                        <div className={styles.apptDoctor}>{patientLabel}</div>
                        <div className={styles.apptMember}>Status: {formatStatusLabel(status)}</div>
                      </div>
                      <div className={styles.apptRight}>
                        <span className={statusClass}>{formatStatusLabel(status)}</span>
                        <Link className={styles.actionBtn} href={`/patients/${appt.patientId}?appointmentId=${appt._id}`}>
                          View profile
                        </Link>
                        {canAct ? (
                          <>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              disabled={busy}
                              onClick={() => void handleStaffComplete(appt._id)}
                            >
                              {busy ? 'Working…' : 'Complete'}
                            </button>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              disabled={busy}
                              onClick={() => void handleStaffCancel(appt._id)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

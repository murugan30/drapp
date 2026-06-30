'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../../lib/auth';
import { useOfflineStatus } from '../../../lib/offline';
import { apiFetch } from '../../../lib/api';

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
  const [todayIso, setTodayIso] = useState('');

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
        const iso = `${y}-${m}-${d}`;
        setTodayIso(iso);

        const patientsRes = await apiFetch<{ items: any[]; total: number; page: number; limit: number }>(
          '/patients?page=1&limit=1',
        );
        setTotalPatients(Number(patientsRes?.total || 0));

        const appts = await apiFetch<any[]>(`/appointments/by-doctor?doctorId=${user.id}&date=${iso}`);
        const list = appts || [];
        setTodayCount(list.length);
        setTodayAppointments(list.slice(0, 5));
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

  const kpiCards = [
    {
      label: 'Today’s Appointments',
      value: loadingStats ? '—' : todayCount,
      hint: todayIso,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      label: 'Total Patients',
      value: loadingStats ? '—' : totalPatients,
      hint: 'Registered',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        </svg>
      ),
      color: 'emerald',
    },
    {
      label: 'Workspace',
      value: roleLabel,
      hint: name || 'Staff',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      ),
      color: 'indigo',
    },
  ];

  const colorMap: Record<string, { gradient: string; bg: string; text: string; soft: string }> = {
    blue: { gradient: 'from-blue-500 to-[#0254b7]', bg: 'bg-blue-50', text: 'text-[#0254b7]', soft: 'bg-blue-500/10' },
    emerald: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', soft: 'bg-emerald-500/10' },
    indigo: { gradient: 'from-indigo-500 to-violet-600', bg: 'bg-indigo-50', text: 'text-indigo-600', soft: 'bg-indigo-500/10' },
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-6xl mx-auto">
        {/* Floating welcome card */}
        <div className="relative bg-gradient-to-br from-[#0254b7] to-[#0b4bba] rounded-[2.5rem] px-6 sm:px-8 pt-6 pb-8 shadow-xl shadow-blue-500/20 overflow-hidden mb-6">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur border border-white/20 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {roleLabel}
                </span>
                {offline ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 border border-amber-300/30 px-3 py-1 text-xs font-bold text-amber-100">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {t('offline')}
                  </span>
                ) : null}
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border-2 border-white/30 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {name ? name.charAt(0).toUpperCase() : 'S'}
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {t('welcome')}{name ? `, ${name}` : ''}
            </h1>
            <p className="mt-2 text-blue-100 text-sm font-medium">Your clinic workspace at a glance.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/patients" className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#0254b7] px-4 py-2.5 text-sm font-bold shadow-lg hover:bg-blue-50 transition-colors active:scale-95">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M19 8v6" /><path d="M22 11h-6" /></svg>
                {t('addPatient')}
              </Link>
              <Link href="/appointments/staff-book" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur text-white border border-white/20 px-4 py-2.5 text-sm font-bold hover:bg-white/20 transition-colors active:scale-95">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M12 13v3l2 1" /></svg>
                Book appointment
              </Link>
            </div>
          </div>
        </div>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {kpiCards.map((kpi) => {
            const theme = colorMap[kpi.color];
            return (
              <div key={kpi.label} className={`relative overflow-hidden rounded-3xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 ${theme.bg}`}>
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${theme.soft} blur-2xl`} />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1">
                    <div className={`text-xs font-extrabold uppercase tracking-wider ${theme.text}`}>{kpi.label}</div>
                    <div className="mt-3 text-3xl font-extrabold text-gray-900 tracking-tight">{kpi.value}</div>
                    <div className="mt-1 text-xs font-semibold text-gray-500">{kpi.hint}</div>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${theme.gradient} text-white flex items-center justify-center shadow-md shrink-0`}>
                    <span className="w-7 h-7">{kpi.icon}</span>
                  </div>
                </div>
                <div className="relative mt-4 h-1 w-full bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} style={{ width: '70%' }} />
                </div>
              </div>
            );
          })}
        </div>

        {statsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 mb-6">{statsError}</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today’s Schedule */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0254b7] flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M12 13v3l2 1" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Today’s Schedule</h3>
                  <p className="text-xs font-semibold text-gray-400">{isDoctor ? 'Your appointments' : 'Appointments linked to your workspace'}</p>
                </div>
              </div>
              <Link href="/appointments" className="text-sm font-bold text-[#0254b7] hover:text-blue-700">View all</Link>
            </div>

            {loadingStats ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-gray-50 animate-pulse" />
                ))}
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-gray-300 mb-3">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M12 13v3l2 1" /></svg>
                </div>
                <div className="text-sm font-bold text-gray-900">No appointments today</div>
                <div className="text-xs font-semibold text-gray-400 mt-1">Book a slot or update availability.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((a) => (
                  <div key={a._id} className="flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 hover:border-blue-200 transition-colors">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex flex-col items-center justify-center text-[#0254b7] font-bold shrink-0">
                      <span className="text-xs text-gray-400 font-semibold uppercase">{appointmentTime(a).split(' ')[1] || ''}</span>
                      <span className="text-sm">{appointmentTime(a).split(' ')[0] || ''}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{patientName(a)}</div>
                      <div className="text-xs font-semibold text-gray-500 capitalize mt-0.5">{a.status || 'Scheduled'}</div>
                    </div>
                    <Link href={`/appointments/consultation/${a._id}`} className="shrink-0 rounded-xl bg-[#0254b7] text-white px-4 py-2 text-xs font-bold hover:bg-blue-700 active:scale-95 transition-colors">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
            </div>

            <div className="space-y-3">
              {[
                { href: '/patients', label: 'Add Patient', sub: 'Create or find a profile', icon: 'user', color: 'bg-blue-50 text-[#0254b7]' },
                { href: '/appointments/staff-book', label: 'Book Appointment', sub: 'For any patient', icon: 'calendar', color: 'bg-emerald-50 text-emerald-600' },
                { href: '/documents', label: 'Upload Document', sub: 'Reports & prescriptions', icon: 'file', color: 'bg-amber-50 text-amber-600' },
                { href: '/health-records', label: 'Health Records', sub: 'Browse patient records', icon: 'heart', color: 'bg-rose-50 text-rose-600' },
                { href: '/availability', label: 'Availability', sub: 'Slots for the week', icon: 'clock', color: 'bg-purple-50 text-purple-600' },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-3 rounded-2xl p-3 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all active:scale-[0.98]">
                  <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center shrink-0`}>
                    {action.icon === 'user' && <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>}
                    {action.icon === 'calendar' && <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>}
                    {action.icon === 'file' && <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" /></svg>}
                    {action.icon === 'heart' && <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
                    {action.icon === 'clock' && <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{action.label}</div>
                    <div className="text-xs font-semibold text-gray-400">{action.sub}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

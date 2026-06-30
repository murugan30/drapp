'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';

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

export default function HomePage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [activeMemberName, setActiveMemberName] = useState<string>('');
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [recordCount, setRecordCount] = useState(0);

  // Smart Greeting Logic
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const dateFormater = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const todayStr = dateFormater.format(new Date());

  useEffect(() => {
    const loadData = async () => {
      if (!user || user.role !== 'patient') {
        setLoading(false);
        setSummaryLoading(false);
        return;
      }

      setLoading(true);
      setSummaryLoading(true);
      try {
        const storageKey = `activeMemberId:${user.id}`;
        const storedActiveId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;

        const [m, d] = await Promise.all([
          apiFetch<Member[]>('/patients/my'),
          apiFetch<DoctorPublic[]>('/users/doctors-public'),
        ]);

        const membersList = m || [];
        setMembers(membersList);
        setDoctors(d || []);

        const selectedId = storedActiveId && membersList.some((x) => x._id === storedActiveId)
          ? storedActiveId
          : membersList[0]?._id || null;

        setActiveMemberId(selectedId);

        const selectedMember = selectedId ? membersList.find((x) => x._id === selectedId) : null;
        setActiveMemberName(selectedMember?.fullName || membersList[0]?.fullName || '');

        const lists = await Promise.all(
          membersList.map((mem) => apiFetch<Appointment[]>(`/appointments/by-patient?patientId=${mem._id}`)),
        );
        setAppointments(lists.flat());

        if (selectedId) {
          const [docs, records] = await Promise.all([
            apiFetch<any[]>(`/documents/by-patient?patientId=${selectedId}`).catch(() => []),
            apiFetch<any[]>(`/medical-records/by-patient?patientId=${selectedId}`).catch(() => []),
          ]);
          setDocumentCount(Array.isArray(docs) ? docs.length : 0);
          setRecordCount(Array.isArray(records) ? records.length : 0);
        } else {
          setDocumentCount(0);
          setRecordCount(0);
        }
      } catch {
        setMembers([]);
        setDoctors([]);
        setAppointments([]);
        setActiveMemberId(null);
        setActiveMemberName('');
        setDocumentCount(0);
        setRecordCount(0);
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    };

    void loadData();
  }, [user]);

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

  const now = Date.now();
  const upcomingAppointment = useMemo(() => {
    const next = (appointments || [])
      .filter((a) => {
        const status = (a.status || 'scheduled').toLowerCase();
        if (status !== 'scheduled') return false;
        return new Date(a.scheduledAt).getTime() > now;
      })
      .slice()
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    return next || null;
  }, [appointments, now]);

  const recentAppointment = useMemo(() => {
    const prev = (appointments || [])
      .filter((a) => new Date(a.scheduledAt).getTime() <= now)
      .slice()
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())[0];
    return prev || null;
  }, [appointments, now]);

  const summaryCards = [
    {
      label: 'Documents',
      value: summaryLoading ? '—' : documentCount,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
        </svg>
      ),
      color: 'from-amber-400 to-orange-500',
      bg: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Records',
      value: summaryLoading ? '—' : recordCount,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      color: 'from-rose-400 to-pink-500',
      bg: 'bg-rose-50 text-rose-600',
    },
    {
      label: 'Appointments',
      value: loading ? '—' : appointments.length,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      ),
      color: 'from-blue-400 to-[#0254b7]',
      bg: 'bg-blue-50 text-[#0254b7]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <div className="max-w-2xl mx-auto">
        {/* Floating welcome card */}
        <div className="relative bg-gradient-to-br from-[#0254b7] to-[#0b4bba] rounded-[2.5rem] px-6 sm:px-8 pt-6 pb-8 shadow-xl shadow-blue-500/20 overflow-hidden mb-6">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold text-blue-200 tracking-widest uppercase flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {todayStr}
              </p>
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur border-2 border-white/30 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {activeMemberName ? activeMemberName.charAt(0).toUpperCase() : (user?.name ? user.name.charAt(0).toUpperCase() : 'P')}
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {greeting},
            </h1>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-white/90">{activeMemberName || user?.name || 'Patient'}</p>

            {/* Member selector */}
            <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
              {members.map((m) => {
                const active = m._id === activeMemberId;
                return (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => {
                      setActiveMemberId(m._id);
                      const storageKey = `activeMemberId:${user?.id}`;
                      if (typeof window !== 'undefined' && user?.id) {
                        window.localStorage.setItem(storageKey, m._id);
                      }
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 rounded-full pl-1 pr-4 py-1 border transition-all ${active ? 'bg-white text-[#0254b7] border-white shadow-lg' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bg-[#0254b7] text-white' : 'bg-white/20 text-white'}`}>
                      {m.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold">{m.fullName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Up Next */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-gray-900">Up Next</h2>
            {upcomingAppointment && (
              <Link href="/appointments" className="text-sm font-bold text-[#0254b7] hover:text-blue-700">View All</Link>
            )}
          </div>

          {loading ? (
            <div className="h-48 bg-white rounded-3xl border border-slate-100 shadow-lg p-6 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#0254b7] animate-spin" />
            </div>
          ) : upcomingAppointment ? (
            <div className="relative overflow-hidden bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div className="relative flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0254b7] to-indigo-600 flex items-center justify-center text-white shadow-md">
                      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 2v3" /><path d="M16 2v3" /><path d="M3 9h18" /><path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                      </svg>
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Confirmed
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-gray-900">{doctorNameById.get(upcomingAppointment.doctorId) || 'Doctor'}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-[#0254b7]">
                      {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(upcomingAppointment.scheduledAt))}
                    </div>
                    <div className="text-xs font-semibold text-gray-400">
                      {new Date(upcomingAppointment.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>
                  {memberNameById.get(upcomingAppointment.patientId) || 'Member'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/50 p-6 text-center flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7] mb-4">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-1">No upcoming visits</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-[200px]">Your schedule is clear. Need to see a doctor?</p>
              <Link href="/appointments" className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#0254b7] text-white font-bold text-sm shadow-md hover:bg-blue-700 active:scale-95 transition-all">
                Book a Doctor
              </Link>
            </div>
          )}
        </div>

        {/* Health Snapshot */}
        <div className="mb-6">
          <div className="px-1 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Health Snapshot</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {summaryCards.map((card) => (
              <Link key={card.label} href="/health-records" className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                <div className={`w-10 h-10 rounded-2xl ${card.bg} flex items-center justify-center mb-3`}>
                  {card.icon}
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</div>
                <div className="mt-1 text-2xl font-extrabold text-gray-900">{card.value}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <div className="px-1 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/appointments', label: 'Book Visit', sub: 'Schedule new', icon: 'plus', color: 'bg-indigo-50 text-indigo-500' },
              { href: '/health-records', label: 'Records', sub: 'Vitals & labs', icon: 'activity', color: 'bg-rose-50 text-rose-500' },
              { href: '/documents', label: 'Uploads', sub: 'Documents', icon: 'file', color: 'bg-emerald-50 text-emerald-500' },
              { href: '/patients', label: 'Family', sub: 'Members', icon: 'users', color: 'bg-amber-50 text-amber-500' },
            ].map((action) => (
              <Link key={action.label} href={action.href} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3 hover:border-blue-200 hover:shadow-md active:scale-[0.97] transition-all group">
                <div className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  {action.icon === 'plus' && <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>}
                  {action.icon === 'activity' && <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
                  {action.icon === 'file' && <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>}
                  {action.icon === 'users' && <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{action.label}</div>
                  <div className="text-xs text-gray-400 font-semibold mt-0.5">{action.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Summary */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-blue-100/60 blur-2xl" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-indigo-100/60 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold tracking-widest text-[#0254b7] uppercase">Recent Activity</div>
                {recentAppointment ? (
                  <div className="mt-2 text-sm text-gray-600 font-medium">
                    Last visit: <span className="font-bold text-gray-900">{doctorNameById.get(recentAppointment.doctorId) || 'Doctor'}</span>
                    {' · '}
                    {new Date(recentAppointment.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-gray-500 font-medium">No recent appointments yet.</div>
                )}
              </div>
              <Link href="/health-records" className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-[#0254b7] text-white font-bold text-sm shadow-md hover:bg-blue-700 active:scale-95 transition-all">
                Records
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

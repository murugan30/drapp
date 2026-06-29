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

  return (
    <div className="-mx-6 md:-mx-8 min-h-[calc(100vh-var(--shell-top-offset))] pb-12">
      {/* Dynamic Native-Feel Header */}
      <div className="px-6 md:px-8 pt-2 pb-10 rounded-b-[2.5rem] mb-8 relative z-10 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-bold text-[#0254b7] tracking-widest uppercase flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {todayStr}
          </p>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-0.5 border-2 border-white shadow-sm ring-1 ring-black/5">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0254b7] to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-inner overflow-hidden">
              {/* Display First Initial */}
              {activeMemberName ? activeMemberName.charAt(0).toUpperCase() : (user?.name ? user.name.charAt(0).toUpperCase() : 'P')}
            </div>
          </div>
        </div>
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-gray-900 mt-2">
          {greeting},<br />
          <span className="text-3xl text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-500">
            {activeMemberName || user?.name || 'Patient'}
          </span>
        </h1>
      </div>

      <div className="max-w-md mx-auto px-6 md:px-8 space-y-8">

        {/* Up Next - Hero Card */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-gray-900">Up Next</h2>
            {upcomingAppointment && (
              <Link href="/appointments" className="text-sm font-bold text-[#0254b7] hover:text-blue-700 active:text-blue-800 transition-colors">
                View All
              </Link>
            )}
          </div>

          {loading ? (
            <div className="h-40 bg-white rounded-[2rem] border border-gray-100 p-6 flex items-center justify-center animate-pulse">
              <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#0254b7] animate-spin" />
            </div>
          ) : upcomingAppointment ? (
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0254b7] to-[#0b4bba] rounded-[2rem] p-6 shadow-lg shadow-blue-500/20 text-white">
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-blue-300 opacity-20 rounded-full blur-xl pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold tracking-wide uppercase mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Confirmed
                  </div>
                  <h3 className="text-xl font-bold leading-tight mb-1">
                    {doctorNameById.get(upcomingAppointment.doctorId) || 'Doctor'}
                  </h3>
                  <p className="text-blue-100 text-sm font-medium">
                    {memberNameById.get(upcomingAppointment.patientId) || 'Member'}
                    {' · '}
                    {new Date(upcomingAppointment.scheduledAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-4 bg-black/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-100 uppercase tracking-widest">Time</div>
                      <div className="text-sm font-bold">
                        {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(upcomingAppointment.scheduledAt))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm text-center flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7] mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
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

        {/* Quick Actions Grid */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-200 fill-mode-both">
          <div className="px-1 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/appointments" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-blue-100 hover:shadow-md active:scale-[0.97] transition-all group">
              <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-tight">Book Visit</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">Schedule new</div>
              </div>
            </Link>

            <Link href="/health-records" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-rose-100 hover:shadow-md active:scale-[0.97] transition-all group">
              <div className="w-12 h-12 rounded-[1rem] bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-100 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-tight">Records</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">Vitals & labs</div>
              </div>
            </Link>

            <Link href="/health-records" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-emerald-100 hover:shadow-md active:scale-[0.97] transition-all group">
              <div className="w-12 h-12 rounded-[1rem] bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-100 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.5 20.5 7 17l3.5-3.5" />
                  <path d="M7 17h8.5a4.5 4.5 0 0 0 0-9h-1.3" />
                  <rect x="2" y="4" width="20" height="20" rx="2" ry="2" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-tight">Prescriptions</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">Medications</div>
              </div>
            </Link>

            <Link href="/patients" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-amber-100 hover:shadow-md active:scale-[0.97] transition-all group">
              <div className="w-12 h-12 rounded-[1rem] bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-100 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm leading-tight">Family</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">Manage members</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Summary */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 delay-300 fill-mode-both">
          <div className="px-1 mb-3">
            <h2 className="text-lg font-bold text-gray-900">Your Summary</h2>
          </div>
          <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-blue-100/60 blur-2xl" />
            <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-indigo-100/60 blur-2xl" />
 
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold tracking-widest text-[#0254b7] uppercase">Active member</div>
                  <div className="mt-1 text-base font-bold text-gray-900">
                    {activeMemberName || '—'}
                  </div>
                  {recentAppointment ? (
                    <div className="mt-2 text-sm text-gray-500 font-medium">
                      Last appointment:{' '}
                      <span className="text-gray-700">
                        {doctorNameById.get(recentAppointment.doctorId) || 'Doctor'}
                      </span>
                      {' · '}
                      {new Date(recentAppointment.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500 font-medium">No recent appointments yet.</div>
                  )}
                </div>
 
                <Link
                  href="/health-records"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-[#0254b7] text-white font-bold text-sm shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Open records
                </Link>
              </div>
 
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 bg-white/70 p-4">
                  <div className="text-xs font-bold text-gray-500">Documents</div>
                  <div className="mt-1 text-2xl font-extrabold text-gray-900">
                    {summaryLoading ? '—' : documentCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white/70 p-4">
                  <div className="text-xs font-bold text-gray-500">Records</div>
                  <div className="mt-1 text-2xl font-extrabold text-gray-900">
                    {summaryLoading ? '—' : recordCount}
                  </div>
                </div>
              </div>
 
              {activeMemberId ? (
                <div className="mt-4 text-xs text-gray-400 font-medium">
                  Showing summary for your active member.
                </div>
              ) : null}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

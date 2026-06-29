'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';

type Member = {
  _id: string;
  fullName: string;
  relationship?: string;
};

type PatientDoc = {
  _id: string;
  fileName: string;
  mimeType: string;
  size: number;
  category?: string;
  createdAt?: string;
};

type Patient = {
  _id: string;
  fullName: string;
  phone?: string;
};

type PatientPagedResponse = {
  items: Patient[];
  total: number;
  page: number;
  limit: number;
};

type CategoryKey = 'prescriptions' | 'lab' | 'imaging' | 'uploads' | 'other';

function getDocCategory(doc: PatientDoc): CategoryKey {
  const name = (doc.fileName || '').toLowerCase();
  const mime = (doc.mimeType || '').toLowerCase();

  if (doc.category === 'uploads') return 'uploads';
  if (doc.category === 'lab') return 'lab';

  if (name.includes('prescription') || name.includes('rx') || name.includes('presc')) return 'prescriptions';
  if (name.includes('lab') || name.includes('report') || name.includes('test')) return 'lab';
  if (
    mime.startsWith('image/') ||
    name.includes('xray') ||
    name.includes('x-ray') ||
    name.includes('scan') ||
    name.includes('mri') ||
    name.includes('ct') ||
    name.includes('ultrasound')
  ) {
    return 'imaging';
  }
  return 'other';
}

export default function HealthRecordsPage() {
  const { user } = useAuth();

  const isPatient = user?.role === 'patient';
  const isStaff = user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'assistant' || user?.role === 'lab';

  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [docs, setDocs] = useState<PatientDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [searching, setSearching] = useState(false);

  const [phoneFilter, setPhoneFilter] = useState<'all' | 'with_phone' | 'no_phone'>('all');
  const [patientSort, setPatientSort] = useState<'name_asc' | 'name_desc'>('name_asc');
  const [directoryFiltersOpen, setDirectoryFiltersOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (!isPatient) return;
      setError(null);
      try {
        const m = await apiFetch<Member[]>('/patients/my');
        const list = m || [];
        setMembers(list);
        const storageKey = `activeMemberId:${user.id}`;
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const next = stored && list.some((x) => x._id === stored) ? stored : list[0]?._id || '';
        setActiveMemberId(next);
        if (next && typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, next);
        }
      } catch (e: any) {
        setMembers([]);
        setActiveMemberId('');
        setError(e?.message || 'Failed to load members');
      }
    };
    void load();
  }, [isPatient, user]);

  useEffect(() => {
    const loadDocs = async () => {
      if (!isPatient) return;
      if (!activeMemberId) {
        setDocs([]);
        return;
      }
      setLoadingDocs(true);
      setError(null);
      try {
        const d = await apiFetch<PatientDoc[]>(`/documents/by-patient?patientId=${activeMemberId}`);
        setDocs(d || []);
      } catch (e: any) {
        setDocs([]);
        setError(e?.message || 'Failed to load documents');
      } finally {
        setLoadingDocs(false);
      }
    };
    void loadDocs();
  }, [activeMemberId, isPatient]);

  const counts = useMemo(() => {
    const c: Record<CategoryKey, number> = { prescriptions: 0, lab: 0, imaging: 0, uploads: 0, other: 0 };
    for (const d of docs) {
      c[getDocCategory(d)] += 1;
    }
    return c;
  }, [docs]);

  const loadPatients = async (opts?: { nextPage?: number; reset?: boolean; qOverride?: string }) => {
    if (!isStaff) return;
    const nextPage = opts?.nextPage || 1;
    const reset = !!opts?.reset;
    setSearching(true);
    setError(null);
    try {
      const q = (opts?.qOverride ?? query).trim();
      const qs = new URLSearchParams();
      qs.set('page', String(nextPage));
      qs.set('limit', String(limit));
      if (q) qs.set('q', q);
      const res = await apiFetch<PatientPagedResponse>(`/patients?${qs.toString()}`);
      const items = res?.items || [];
      setTotalPatients(Number(res?.total || 0));
      setPage(Number(res?.page || nextPage));
      setPatients((prev) => (reset ? items : [...prev, ...items]));
    } catch (e: any) {
      if (reset) setPatients([]);
      setTotalPatients(0);
      setError(e?.message || 'Failed to load patients');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!isStaff) return;
    void loadPatients({ nextPage: 1, reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  useEffect(() => {
    if (!directoryFiltersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDirectoryFiltersOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [directoryFiltersOpen]);

  const visiblePatients = useMemo(() => {
    let out = patients.slice();
    if (phoneFilter === 'with_phone') out = out.filter((p) => !!(p.phone || '').trim());
    if (phoneFilter === 'no_phone') out = out.filter((p) => !(p.phone || '').trim());

    out.sort((a, b) => {
      const an = (a.fullName || '').toLowerCase();
      const bn = (b.fullName || '').toLowerCase();
      if (an < bn) return patientSort === 'name_asc' ? -1 : 1;
      if (an > bn) return patientSort === 'name_asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [patients, patientSort, phoneFilter]);

  return (
    <div className="px-4 py-5 pb-24">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">
            {isPatient ? 'Browse Records' : isStaff ? 'Patient Directory' : 'Health Records'}
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {isPatient
              ? 'Select a family member to view their prescriptions, lab reports, and more.'
              : isStaff
                ? 'Search patients by mobile or name to view their health records.'
                : 'Health records are available for patients and doctors.'}
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 backdrop-blur-sm">{error}</div>
        ) : null}

        {isPatient ? (
          <>
            {/* Member Selector */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Family Member</h3>
              <div className="flex overflow-x-auto gap-3 pb-2 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
                {members.length === 0 ? (
                  <div className="text-xs font-semibold text-gray-500">No members found.</div>
                ) : (
                  members.map((m) => {
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
                        className={`flex-shrink-0 inline-flex items-center justify-center px-5 h-10 rounded-full text-sm font-bold transition-all ${active
                          ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                          }`}
                      >
                        {m.fullName}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Categories</h3>
                <div className="text-xs font-semibold text-[#0254b7] bg-blue-50 px-3 py-1 rounded-full">{loadingDocs ? 'Loading' : `${docs.length} files`}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category Card: Prescriptions */}
                <Link
                  href={activeMemberId ? `/health-records/${activeMemberId}/prescriptions` : '#'}
                  className="group relative rounded-2xl bg-blue-50/50 p-4 border border-blue-100/50 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#0254b7] shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{counts.prescriptions}</div>
                    <div className="text-xs font-medium text-gray-500">Prescriptions</div>
                  </div>
                </Link>

                {/* Category Card: Lab */}
                <Link
                  href={activeMemberId ? `/health-records/${activeMemberId}/lab` : '#'}
                  className="group relative rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100/50 flex flex-col gap-2 hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31M14 9.3V1.99M8.5 2h7M14 9.3a6.5 6.5 0 11-4 0" /><path d="M5.52 16h12.96" /></svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{counts.lab}</div>
                    <div className="text-xs font-medium text-gray-500">Lab Reports</div>
                  </div>
                </Link>

                {/* Category Card: Imaging */}
                <Link
                  href={activeMemberId ? `/health-records/${activeMemberId}/imaging` : '#'}
                  className="group relative rounded-2xl bg-purple-50/50 p-4 border border-purple-100/50 flex flex-col gap-2 hover:bg-purple-50 hover:border-purple-200 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-purple-600 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{counts.imaging}</div>
                    <div className="text-xs font-medium text-gray-500">Imaging</div>
                  </div>
                </Link>

                {/* Category Card: My Uploads */}
                <Link
                  href={activeMemberId ? `/health-records/${activeMemberId}/uploads` : '#'}
                  className="group relative rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100/50 flex flex-col gap-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{counts.uploads}</div>
                    <div className="text-xs font-medium text-gray-500">My Uploads</div>
                  </div>
                </Link>

                {/* Category Card: Other */}
                <Link
                  href={activeMemberId ? `/health-records/${activeMemberId}/other` : '#'}
                  className="group relative rounded-2xl bg-orange-50/50 p-4 border border-orange-100/50 flex flex-col gap-2 hover:bg-orange-50 hover:border-orange-200 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-orange-600 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{counts.other}</div>
                    <div className="text-xs font-medium text-gray-500">Other</div>
                  </div>
                </Link>
              </div>
            </div>
          </>
        ) : isStaff ? (
          <div className="flex flex-col gap-5 mt-2">
            {/* Stats Hero */}
            <div className="rounded-3xl bg-gradient-to-br from-[#0254b7] to-[#4a90e2] p-5 text-white shadow-lg shadow-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold tracking-tight">{totalPatients}</div>
                  <div className="text-sm font-medium text-white/80">Total Patients</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
              </div>
              <div className="mt-3 text-xs font-medium text-white/70">
                {visiblePatients.length} shown with current filters
              </div>
            </div>

            {/* Toolbar */}
            <div className="rounded-3xl bg-white/70 ring-1 ring-slate-200/70 backdrop-blur p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                  <input
                    className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0254b7]/20 focus:border-[#0254b7] shadow-sm transition-all"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void loadPatients({ nextPage: 1, reset: true });
                      }
                    }}
                    placeholder="Search by name or mobile"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setDirectoryFiltersOpen(true)}
                  className="shrink-0 h-11 w-11 rounded-2xl bg-[#f0f5ff] text-[#0254b7] border border-blue-100/60 flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="Open filters"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M7 12h10" />
                    <path d="M10 18h4" />
                  </svg>
                </button>

                <select
                  value={patientSort}
                  onChange={(e) => setPatientSort(e.target.value as any)}
                  className="shrink-0 bg-white border border-gray-200 rounded-2xl px-3 h-11 text-xs font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0254b7]/20 focus:border-[#0254b7]"
                  aria-label="Sort patients"
                >
                  <option value="name_asc">Sort: A-Z</option>
                  <option value="name_desc">Sort: Z-A</option>
                </select>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-600">
                  {searching ? 'Loading…' : `${visiblePatients.length} of ${totalPatients || '—'} patients`}
                </div>
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      void loadPatients({ nextPage: 1, reset: true, qOverride: '' });
                    }}
                    className="text-xs font-bold text-[#0254b7] hover:text-blue-700"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>

            {/* Directory Filters Bottom Sheet */}
            {directoryFiltersOpen ? (
              <div
                className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={() => setDirectoryFiltersOpen(false)}
              >
                <div
                  className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900">Filters</div>
                      <div className="text-xs font-medium text-gray-500">Refine patient list</div>
                    </div>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
                      onClick={() => setDirectoryFiltersOpen(false)}
                      aria-label="Close filters"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="px-5 py-5 flex flex-col gap-5">
                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Phone</div>
                      <div className="mt-3 flex overflow-x-auto gap-2 pb-2 -mx-5 px-5 hide-scrollbar [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          onClick={() => setPhoneFilter('all')}
                          className={`flex-shrink-0 inline-flex items-center px-4 h-9 rounded-full text-xs font-bold transition-all ${phoneFilter === 'all'
                            ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                            : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                            }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhoneFilter('with_phone')}
                          className={`flex-shrink-0 inline-flex items-center px-4 h-9 rounded-full text-xs font-bold transition-all ${phoneFilter === 'with_phone'
                            ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                            : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                            }`}
                        >
                          With phone
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhoneFilter('no_phone')}
                          className={`flex-shrink-0 inline-flex items-center px-4 h-9 rounded-full text-xs font-bold transition-all ${phoneFilter === 'no_phone'
                            ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                            : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                            }`}
                        >
                          Missing phone
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sort</div>
                      <div className="mt-3 inline-flex items-center gap-1 rounded-2xl bg-gray-50 border border-gray-200 p-1">
                        <button
                          type="button"
                          onClick={() => setPatientSort('name_asc')}
                          className={`px-4 h-9 rounded-xl text-xs font-bold transition-colors ${patientSort === 'name_asc'
                            ? 'bg-[#0254b7] text-white'
                            : 'bg-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                          A-Z
                        </button>
                        <button
                          type="button"
                          onClick={() => setPatientSort('name_desc')}
                          className={`px-4 h-9 rounded-xl text-xs font-bold transition-colors ${patientSort === 'name_desc'
                            ? 'bg-[#0254b7] text-white'
                            : 'bg-transparent text-gray-600 hover:text-gray-900'
                            }`}
                        >
                          Z-A
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneFilter('all');
                        setPatientSort('name_asc');
                      }}
                      className="text-sm font-bold text-gray-600 hover:text-gray-900"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectoryFiltersOpen(false)}
                      className="rounded-2xl bg-[#0254b7] px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 active:scale-95 transition-transform"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Patient List */}
            <div className="flex flex-col gap-3">
              {visiblePatients.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">No patients found</div>
                    <div className="text-xs font-medium text-gray-500 mt-1">Try changing your search or filters.</div>
                  </div>
                </div>
              ) : (
                <>
                  {visiblePatients.map((p) => {
                    const initial = (p.fullName?.trim?.()?.[0] || 'P').toUpperCase();
                    return (
                      <div key={p._id} className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 flex flex-col gap-3 hover:border-blue-200 transition-all">
                        <div className="flex gap-3 items-start">
                          <div className="w-12 h-12 bg-[#f0f5ff] rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-[#0254b7] text-lg">
                            {initial}
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm md:text-base truncate tracking-tight">{p.fullName || 'Patient'}</h3>
                            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
                              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
                              <span className="truncate">{p.phone || 'No phone'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-gray-50" />

                        <div className="flex gap-3">
                          <Link
                            href={`/health-records/${p._id}/all`}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#f0f5ff] text-[#0254b7] hover:bg-blue-100 transition-colors text-center active:scale-95"
                          >
                            View Records
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                  {patients.length < totalPatients ? (
                    <button
                      type="button"
                      onClick={() => void loadPatients({ nextPage: page + 1, reset: false })}
                      disabled={searching}
                      className="rounded-2xl border border-gray-100 bg-white py-3.5 text-sm font-bold text-gray-700 shadow-sm active:scale-95 transition-all mt-2 disabled:opacity-60"
                    >
                      {searching ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading...
                        </span>
                      ) : 'Load More'}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        {!isPatient && !isStaff ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col items-center justify-center text-center gap-2 shadow-sm">
            <div className="text-sm font-bold text-gray-900">Not available</div>
            <div className="text-xs font-medium text-gray-500 max-w-[200px]">This page is only available for logged in patients and doctors.</div>
          </div>
        ) : null}

        {isPatient && docs.length > 0 ? (
          <div className="mt-6 text-xs font-semibold text-gray-500">Tip: To view & download files, open a category.</div>
        ) : null}
      </div>
    </div>
  );
}

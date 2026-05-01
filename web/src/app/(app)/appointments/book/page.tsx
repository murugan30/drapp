'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '../../../../lib/api';
import TopHeader from '../../../../components/TopHeader';
import styles from '../appointments.module.css';

type DoctorPublic = {
  id: string;
  name: string;
  slotMinutes?: number;
};

export default function BookAppointmentChooseDoctorPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();

  const patientId = searchParams?.get('patientId') || '';

  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await apiFetch<DoctorPublic[]>('/users/doctors-public');
        setDoctors(d || []);
      } catch (e: any) {
        setDoctors([]);
        setError(e?.message || 'Failed to load doctors');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => d.name.toLowerCase().includes(q));
  }, [doctors, search]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f8faff] text-gray-900 pb-10 absolute inset-0 z-50">
      {/* Top Bar - Frosted Glass */}
      <TopHeader title="Book Appointment" backHref={patientId ? '/appointments/staff-book' : '/appointments'} />

      <div className="flex flex-col px-6 pt-6 pb-2 gap-6 flex-1">
        {/* Hero Text */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">
            Choose a Specialist
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500 max-w-[260px]">
            Select your preferred doctor to view their available time slots.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0254b7]/20 focus:border-[#0254b7] shadow-sm transition-all"
            placeholder="Search doctors by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? <div className={styles.bannerError}>{error}</div> : null}

        {/* List */}
        <div className="flex flex-col gap-4 mt-2">
          {loading ? (
            <div className="text-center text-gray-400 py-10 font-medium">Loading doctors...</div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center text-gray-400 py-10 font-medium flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></svg>
              </div>
              No doctors found.
            </div>
          ) : (
            filteredDoctors.map((d) => {
              const initial = (d.name?.trim?.()?.[0] || 'D').toUpperCase();
              return (
                <Link
                  key={d.id}
                  href={patientId ? `/appointments/book/${d.id}?patientId=${encodeURIComponent(patientId)}` : `/appointments/book/${d.id}`}
                  className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 flex flex-col gap-3 hover:border-blue-200 transition-all active:scale-[0.98]"
                >
                  {/* Card Body */}
                  <div className="flex gap-3 items-center">
                    <div className="w-12 h-12 bg-blue-50/50 rounded-2xl flex-shrink-0 overflow-hidden relative border border-blue-100/30">
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-blue-400 text-lg group-hover:bg-[#0254b7] group-hover:text-white transition-colors duration-300">
                        {initial}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate tracking-tight">{d.name}</h3>
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
                        <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span className="truncate">{d.slotMinutes || 15} Min Slots</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-50" />

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0254b7]">Available today</span>
                    <div className="inline-flex items-center justify-center gap-1.5 bg-[#f0f5ff] text-[#0254b7] rounded-2xl px-4 py-2 text-xs font-bold group-hover:bg-[#0254b7] group-hover:text-white transition-colors">
                      Select
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

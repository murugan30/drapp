'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { apiFetch } from '../../../../lib/api';
import TopHeader from '../../../../components/TopHeader';

type Patient = {
  _id: string;
  fullName: string;
  phone?: string;
  relationship?: string;
};

export default function StaffBookForPatientPage() {
  const router = useRouter();
  const { user } = useAuth();

  const canBookForPatient = user?.role === 'admin' || user?.role === 'assistant';

  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);

  const cleanedMobile = useMemo(() => mobile.replace(/\D/g, '').slice(0, 10), [mobile]);

  const handleSearch = async () => {
    if (!user) return;
    if (!canBookForPatient) return;
    const m = cleanedMobile;
    if (m.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    setBusy(true);
    setError(null);
    setPatients([]);
    try {
      const res = await apiFetch<Patient[]>(`/patients/by-mobile?mobile=${encodeURIComponent(m)}`);
      setPatients(res || []);
      if (!res || res.length === 0) {
        setError('No members found for this mobile number');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to find patient');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  if (!canBookForPatient) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f8faff] text-gray-900 pb-10 absolute inset-0 z-50">
        <TopHeader title="Book for Patient" backHref="/appointments" />
        <div className="px-6 pt-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-gray-900">Not available</div>
            <div className="mt-1 text-sm font-medium text-gray-500">
              Only Admin/Assistant can book appointments for a patient.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f8faff] text-gray-900 pb-10 absolute inset-0 z-50">
      <TopHeader title="Book for Patient" backHref="/appointments" />

      <div className="flex flex-col px-6 pt-6 pb-8 gap-6 flex-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">Find patient</h2>
          <p className="mt-1 text-sm font-medium text-gray-500 max-w-[280px]">
            Enter the mobile number and select the member to book an appointment.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="flex-1 bg-white border border-gray-100 rounded-2xl overflow-hidden focus-within:border-[#0254b7] focus-within:ring-2 focus-within:ring-[#0254b7]/20 shadow-sm transition-all">
            <div className="flex items-center">
              <div className="pl-4 pr-3 py-3 text-[14px] text-gray-500 font-bold select-none bg-gray-50/50 border-r border-gray-100">
                +91
              </div>
              <input
                className="w-full bg-transparent px-4 py-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400"
                placeholder="10-digit mobile"
                inputMode="numeric"
                value={cleanedMobile}
                onChange={(e) => setMobile(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={busy}
            className="shrink-0 rounded-2xl bg-[#0254b7] px-5 py-3 text-sm font-bold text-white disabled:opacity-60 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            {busy ? 'Wait…' : 'Search'}
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {patients.length > 0 ? `Found ${patients.length} member(s)` : 'Search results'}
          </div>
          <Link className="text-xs font-bold text-[#0254b7] hover:text-blue-700" href="/patients">
            Add patient
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {patients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">No members selected</div>
                <div className="text-xs font-medium text-gray-500 mt-1">Search by mobile to continue.</div>
              </div>
            </div>
          ) : (
            patients.map((p) => {
              const initial = (p.fullName?.trim?.()?.[0] || 'P').toUpperCase();
              return (
                <div
                  key={p._id}
                  className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4 flex flex-col gap-4 hover:border-blue-200 transition-all active:scale-[0.98]"
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-gray-400 text-lg group-hover:bg-[#0254b7] group-hover:text-white transition-colors duration-300">
                      {initial}
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm md:text-base truncate tracking-tight">{p.fullName || 'Patient'}</div>
                      <div className="text-xs font-medium text-gray-500 truncate">
                        {(p.relationship || 'Member')}{p.phone ? ` · ${p.phone}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/appointments/book?patientId=${encodeURIComponent(p._id)}`);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#f0f5ff] text-[#0254b7] hover:bg-blue-100 transition-colors text-center active:scale-95"
                    >
                      Book
                    </button>
                    <Link
                      href={`/appointments/staff-book/${encodeURIComponent(p._id)}`}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100 transition-colors text-center active:scale-95"
                    >
                      Appointments
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

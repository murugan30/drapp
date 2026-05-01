'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../../lib/auth';
import { apiFetch } from '../../../../../lib/api';
import TopHeader from '../../../../../components/TopHeader';

type Appointment = {
  _id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  status?: string;
};

type DoctorPublic = {
  id: string;
  name: string;
};

type PatientLite = {
  _id: string;
  fullName?: string;
  phone?: string;
  relationship?: string;
};

export default function StaffPatientAppointmentsPage() {
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const patientId = params?.patientId as string;
  const canUsePage = user?.role === 'admin' || user?.role === 'assistant';

  const [patient, setPatient] = useState<PatientLite | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doctorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of doctors) map.set(d.id, d.name);
    return map;
  }, [doctors]);

  const refresh = async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, a, d] = await Promise.all([
        apiFetch<PatientLite>(`/patients/${patientId}`),
        apiFetch<Appointment[]>(`/appointments/by-patient?patientId=${patientId}`),
        apiFetch<DoctorPublic[]>('/users/doctors-public'),
      ]);
      setPatient(p || null);
      setAppointments(a || []);
      setDoctors(d || []);
    } catch (e: any) {
      setPatient(null);
      setAppointments([]);
      setDoctors([]);
      setError(e?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!canUsePage) {
      router.push('/appointments');
      return;
    }
    void refresh();
  }, [patientId, user]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (appointments || [])
      .filter((a) => new Date(a.scheduledAt).getTime() >= now)
      .slice()
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [appointments]);

  const past = useMemo(() => {
    const now = Date.now();
    return (appointments || [])
      .filter((a) => new Date(a.scheduledAt).getTime() < now)
      .slice()
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [appointments]);

  const formatStatus = (statusRaw: string) => {
    const s = (statusRaw || '').toLowerCase();
    if (s === 'scheduled') return 'Scheduled';
    if (s === 'cancelled') return 'Cancelled';
    if (s === 'completed') return 'Completed';
    if (!s) return 'Scheduled';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleCancel = async (id: string) => {
    if (!canUsePage) return;
    if (!window.confirm('Cancel this appointment?')) return;
    setError(null);
    setBusyId(id);
    try {
      await apiFetch(`/appointments/${id}/cancel`, { method: 'PATCH' });
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel appointment');
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;
  if (!canUsePage) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8faff] text-gray-900 pb-10 absolute inset-0 z-50">
      <TopHeader title="Patient Appointments" backHref="/appointments/staff-book" />

      <div className="flex flex-col px-6 pt-6 pb-8 gap-6 flex-1">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">
            {patient?.fullName || 'Patient'}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {patient?.phone ? `+91 ${patient.phone}` : '—'}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50/50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex gap-3">
          <Link
            href={`/appointments/book?patientId=${encodeURIComponent(patientId)}`}
            className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#0254b7] text-white shadow-md hover:bg-blue-600 transition-colors text-center active:scale-95"
          >
            Book new appointment
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-gray-900">Upcoming</div>
            <div className="text-xs font-semibold text-gray-600">{loading ? 'Loading…' : `${upcoming.length} items`}</div>
          </div>

          <div className="mt-4 grid gap-3">
            {!loading && upcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6">
                <div className="text-sm font-semibold text-gray-900">No upcoming appointments</div>
                <div className="mt-1 text-xs font-semibold text-gray-600">Book a new slot for this patient.</div>
              </div>
            ) : null}

            {upcoming.map((a) => {
              const d = new Date(a.scheduledAt);
              const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateLabel = d.toLocaleDateString();
              const docName = doctorNameById.get(a.doctorId) || 'Doctor';
              const status = a.status || 'scheduled';
              const canCancel = status === 'scheduled';
              const busy = busyId === a._id;

              return (
                <div key={a._id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div style={{ minWidth: 0 }}>
                      <div className="text-sm font-bold text-gray-900 truncate">{docName}</div>
                      <div className="mt-1 text-xs font-medium text-gray-500">{dateLabel} · {timeLabel}</div>
                      <div className="mt-1 text-[11px] font-semibold text-gray-400">Status: {formatStatus(status)}</div>
                    </div>
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => void handleCancel(a._id)}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors active:scale-95 disabled:opacity-60"
                      >
                        {busy ? 'Working…' : 'Cancel'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-gray-900">Past</div>
            <div className="text-xs font-semibold text-gray-600">{loading ? 'Loading…' : `${past.length} items`}</div>
          </div>

          <div className="mt-4 grid gap-3">
            {!loading && past.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6">
                <div className="text-sm font-semibold text-gray-900">No past appointments</div>
                <div className="mt-1 text-xs font-semibold text-gray-600">Once appointments complete, they’ll appear here.</div>
              </div>
            ) : null}

            {past.slice(0, 10).map((a) => {
              const d = new Date(a.scheduledAt);
              const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateLabel = d.toLocaleDateString();
              const docName = doctorNameById.get(a.doctorId) || 'Doctor';
              const status = a.status || 'scheduled';

              return (
                <div key={a._id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="text-sm font-bold text-gray-900 truncate">{docName}</div>
                  <div className="mt-1 text-xs font-medium text-gray-500">{dateLabel} · {timeLabel}</div>
                  <div className="mt-1 text-[11px] font-semibold text-gray-400">Status: {formatStatus(status)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

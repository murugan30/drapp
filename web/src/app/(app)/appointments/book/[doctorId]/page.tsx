'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../../lib/auth';
import { apiFetch } from '../../../../../lib/api';
import TopHeader from '../../../../../components/TopHeader';
import styles from '../../appointments.module.css';

type DoctorPublic = {
  id: string;
  name: string;
  slotMinutes?: number;
};

type AvailabilitySlot = {
  _id: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone?: string;
};

type BookedAppointment = {
  _id: string;
  scheduledAt: string;
};

type Member = {
  _id: string;
  fullName: string;
};

type PatientLite = {
  _id: string;
  fullName?: string;
  phone?: string;
  relationship?: string;
};

const DEFAULT_SLOT_MINUTES = 15;
const DATE_WINDOW_DAYS = 14;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map((v) => Number(v));
  return h * 60 + m;
}

function buildTimesForSlot(slot: AvailabilitySlot, stepMinutes: number) {
  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  const out: string[] = [];
  for (let t = start; t + stepMinutes <= end; t += stepMinutes) {
    const hh = Math.floor(t / 60);
    const mm = t % 60;
    out.push(`${pad2(hh)}:${pad2(mm)}`);
  }
  return out;
}

function makeLocalIsoWithOffset(date: string, time: string) {
  const d = new Date(`${date}T${time}:00`);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${date}T${time}:00${sign}${oh}:${om}`;
}

function parseIsoDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function formatIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localTodayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export default function BookAppointmentDoctorPage() {
  const router = useRouter();
  const params = useParams<{ doctorId: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const doctorId = params?.doctorId;
  const staffPatientId = searchParams?.get('patientId') || '';
  const todayIso = localTodayIso();

  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const [staffPatient, setStaffPatient] = useState<PatientLite | null>(null);

  const [doctor, setDoctor] = useState<DoctorPublic | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [booked, setBooked] = useState<BookedAppointment[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasSameDayAppt, setHasSameDayAppt] = useState(false);

  const canUsePage = user?.role === 'patient' || user?.role === 'admin' || user?.role === 'assistant';
  const isStaffFlow = user?.role === 'admin' || user?.role === 'assistant';

  useEffect(() => {
    const checkSameDay = async () => {
      if (!user || !canUsePage || !activeMemberId || !selectedDate) {
        setHasSameDayAppt(false);
        return;
      }
      try {
        const appts = await apiFetch<any[]>(`/appointments/by-patient?patientId=${activeMemberId}`);
        const has = (appts || []).some((a) => {
          if (a.status === 'cancelled') return false;
          const d = new Date(a.scheduledAt);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const iso = `${y}-${m}-${day}`;
          return iso === selectedDate;
        });
        setHasSameDayAppt(has);
      } catch {
        setHasSameDayAppt(false);
      }
    };
    void checkSameDay();
  }, [activeMemberId, selectedDate, user]);

  useEffect(() => {
    const load = async () => {
      if (!user || !canUsePage) return;

      if (isStaffFlow) {
        setMembers([]);
        setActiveMemberId(staffPatientId || null);
      } else {
        const storageKey = `activeMemberId:${user.id}`;
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        setActiveMemberId(stored);
      }

      try {
        const doctorReq = apiFetch<DoctorPublic[]>('/users/doctors-public');
        const membersReq = isStaffFlow ? Promise.resolve([] as Member[]) : apiFetch<Member[]>('/patients/my');
        const patientReq = isStaffFlow && staffPatientId ? apiFetch<PatientLite>(`/patients/${staffPatientId}`) : Promise.resolve(null);
        const [m, d, p] = await Promise.all([membersReq, doctorReq, patientReq]);
        setMembers(m || []);
        const found = (d || []).find((row) => row.id === doctorId) || null;
        setDoctor(found);
        setStaffPatient(p as any);
      } catch {
        setMembers([]);
        setDoctor(null);
        setStaffPatient(null);
      }
    };
    void load();
  }, [canUsePage, doctorId, isStaffFlow, staffPatientId, user]);

  useEffect(() => {
    if (selectedDate < todayIso) {
      setSelectedDate(todayIso);
    }
  }, [selectedDate, todayIso]);

  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate, doctorId]);

  const stepMinutes = doctor?.slotMinutes || DEFAULT_SLOT_MINUTES;

  const activeMemberName = useMemo(() => {
    if (!activeMemberId) return null;
    if (isStaffFlow) return staffPatient?.fullName || null;
    return members.find((m) => m._id === activeMemberId)?.fullName || null;
  }, [activeMemberId, members]);

  const doctorName = doctor?.name || 'Doctor';
  const doctorInitial = (doctorName?.trim?.()?.[0] || 'D').toUpperCase();

  const availableDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots || []) set.add(s.date);
    return set;
  }, [slots]);

  const dateChoices = useMemo(() => {
    const out: Array<{ iso: string; dow: string; day: number; available: boolean }> = [];
    for (let i = 0; i < DATE_WINDOW_DAYS; i += 1) {
      const d = addDays(parseIsoDate(todayIso), i);
      const iso = formatIsoDate(d);
      out.push({
        iso,
        dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
        day: d.getDate(),
        available: availableDateSet.has(iso),
      });
    }
    return out;
  }, [availableDateSet, todayIso]);

  const selectedDateAvailable = useMemo(() => {
    if (!doctorId) return false;
    return availableDateSet.has(selectedDate);
  }, [availableDateSet, selectedDate, doctorId]);

  useEffect(() => {
    const loadAvailabilityWindow = async () => {
      if (!user || !canUsePage) return;
      if (!doctorId) {
        setSlots([]);
        return;
      }
      setLoadingDates(true);
      setBookingError(null);
      setBookingSuccess(null);
      try {
        const from = todayIso;
        const to = formatIsoDate(addDays(parseIsoDate(todayIso), DATE_WINDOW_DAYS - 1));
        const s = await apiFetch<AvailabilitySlot[]>(
          `/availability/slots?doctorId=${encodeURIComponent(String(doctorId))}&from=${from}&to=${to}`,
        );
        setSlots(s || []);
      } catch (e: any) {
        setBookingError(e?.message || 'Failed to load availability');
        setSlots([]);
      } finally {
        setLoadingDates(false);
      }
    };
    void loadAvailabilityWindow();
  }, [doctorId, todayIso, user]);

  useEffect(() => {
    if (!doctorId) return;
    if (selectedDate < todayIso) {
      setSelectedDate(todayIso);
      return;
    }
    if (!availableDateSet.has(selectedDate)) {
      const first = dateChoices.find((d) => d.available)?.iso;
      if (first) setSelectedDate(first);
    }
  }, [availableDateSet, dateChoices, selectedDate, doctorId, todayIso]);

  useEffect(() => {
    const loadBookedForDate = async () => {
      if (!user || !canUsePage) return;
      if (!doctorId) return;
      if (!selectedDateAvailable) {
        setBooked([]);
        return;
      }
      setLoadingSlots(true);
      setBookingError(null);
      setBookingSuccess(null);
      try {
        const b = await apiFetch<BookedAppointment[]>(
          `/appointments/booked?doctorId=${encodeURIComponent(String(doctorId))}&date=${selectedDate}`,
        );
        setBooked(b || []);
      } catch (e: any) {
        setBookingError(e?.message || 'Failed to load booked times');
        setBooked([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    void loadBookedForDate();
  }, [selectedDate, selectedDateAvailable, doctorId, user]);

  const bookedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of booked || []) {
      const d = new Date(b.scheduledAt);
      set.add(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    }
    return set;
  }, [booked]);

  const times = useMemo(() => {
    if (!doctorId) return [] as string[];
    const unique = new Set<string>();
    for (const s of slots || []) {
      if (s.date !== selectedDate) continue;
      for (const t of buildTimesForSlot(s, stepMinutes)) {
        unique.add(t);
      }
    }
    return Array.from(unique).sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [selectedDate, doctorId, slots, stepMinutes]);

  const timeGroups = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    for (const time of times) {
      const m = toMinutes(time);
      if (m < 12 * 60) morning.push(time);
      else if (m < 17 * 60) afternoon.push(time);
      else evening.push(time);
    }
    return [
      { key: 'morning', label: 'Morning', times: morning },
      { key: 'afternoon', label: 'Afternoon', times: afternoon },
      { key: 'evening', label: 'Evening', times: evening },
    ];
  }, [times]);

  const nowMinutes = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);

  const canConfirm = !!activeMemberId && !!doctorId && !!selectedTime;

  const handleConfirm = async () => {
    if (!user || !canUsePage) return;
    if (!activeMemberId) {
      setBookingError(isStaffFlow ? 'Please select a patient first' : 'Please select an active member in Family Members first');
      return;
    }
    if (!doctorId) {
      setBookingError('Please select a doctor');
      return;
    }
    if (!selectedTime) return;

    setBooking(true);
    setBookingError(null);
    setBookingSuccess(null);
    setShowConfirmation(false);
    try {
      const scheduledAt = makeLocalIsoWithOffset(selectedDate, selectedTime);
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          patientId: activeMemberId,
          scheduledAt,
        }),
      });
      setBookingSuccess(`Booked at ${selectedTime}`);
      setSelectedTime(null);
      setTimeout(() => router.push('/appointments'), 450);
    } catch (e: any) {
      setBookingError(e?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const fmt12 = (t: string) => {
    const [h, m] = t.split(':');
    const n = parseInt(h, 10);
    return `${n % 12 || 12}:${m} ${n >= 12 ? 'PM' : 'AM'}`;
  };

  const fmtDate = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6FB] text-gray-900 pb-32 absolute inset-0 z-50">
      <TopHeader
        title="Book Appointment"
        backHref={isStaffFlow ? `/appointments/book?patientId=${encodeURIComponent(staffPatientId)}` : '/appointments/book'}
      />

      <div className="flex flex-col gap-5 px-4 pt-4 flex-1">

        {/* Doctor hero card */}
        <div className="relative bg-gradient-to-br from-[#0254b7] to-[#0142a5] rounded-3xl p-5 shadow-lg overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute -right-2 bottom-0 w-20 h-20 bg-white/5 rounded-full" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-2xl border border-white/30 shrink-0">
              {doctorInitial}
            </div>
            <div>
              <div className="text-[11px] font-bold text-blue-200 tracking-widest uppercase mb-0.5">Your Doctor</div>
              <div className="text-xl font-bold text-white leading-tight">{doctorName}</div>
              <div className="text-sm text-blue-200 font-medium mt-0.5">Specialist · {stepMinutes} min slots</div>
            </div>
          </div>
          {activeMemberName ? (
            <div className="mt-4 relative z-10 flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2.5 border border-white/20">
              <svg className="w-4 h-4 text-blue-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span className="text-sm font-semibold text-white">{activeMemberName}</span>
              <span className="ml-auto text-[11px] font-bold text-blue-200 bg-white/10 rounded-full px-2 py-0.5">Booking for</span>
            </div>
          ) : !isStaffFlow ? (
            <div className="mt-4 relative z-10 flex items-center gap-2 bg-orange-400/20 rounded-2xl px-4 py-2.5 border border-orange-300/30">
              <svg className="w-4 h-4 text-orange-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-sm font-medium text-orange-100">No active member — select one in Family</span>
            </div>
          ) : null}
        </div>

        {/* Date strip */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-3 px-1">Select Date</div>
          {loadingDates ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[72px] h-[72px] rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : dateChoices.every((d) => !d.available) ? (
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span className="text-sm font-medium text-gray-400">No availability in the next 2 weeks</span>
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden">
              {dateChoices.map((c) => {
                const active = c.iso === selectedDate;
                const disabled = !c.available;
                const [cy, cm, cd] = c.iso.split('-').map(Number);
                const dObj = new Date(cy, cm - 1, cd);
                const dayNum = dObj.getDate();
                const monStr = dObj.toLocaleDateString(undefined, { month: 'short' });
                const dowStr = c.iso === todayIso ? 'Today' : c.dow;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => { if (!disabled) setSelectedDate(c.iso); }}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl font-bold transition-all active:scale-95 ${
                      active
                        ? 'bg-[#0254b7] text-white shadow-md shadow-blue-200'
                        : disabled
                          ? 'bg-white text-gray-200 border border-gray-100'
                          : 'bg-white text-gray-800 border border-gray-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <span className={`text-[10px] font-bold tracking-wider uppercase ${active ? 'text-blue-200' : disabled ? 'text-gray-200' : 'text-gray-400'}`}>{dowStr}</span>
                    <span className="text-xl font-extrabold leading-tight">{dayNum}</span>
                    <span className={`text-[10px] font-semibold ${active ? 'text-blue-200' : disabled ? 'text-gray-200' : 'text-gray-400'}`}>{monStr}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Time groups */}
        <div>
          <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-3 px-1">Select Time</div>

          {loadingSlots ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !selectedDateAvailable ? (
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span className="text-sm font-medium text-gray-400">Doctor unavailable on this date</span>
            </div>
          ) : times.length === 0 ? (
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-sm font-medium text-gray-400">No slots available for this date</span>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {timeGroups.filter((g) => g.times.length > 0).map((g) => (
                <div key={g.key}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{g.label}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[11px] font-semibold text-gray-300">{g.times.length} slots</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {g.times.map((time) => {
                      const isBooked = bookedSet.has(time);
                      const isPastTime = selectedDate === todayIso && toMinutes(time) < nowMinutes;
                      const disabled = isBooked || booking || isPastTime;
                      const active = selectedTime === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedTime(time)}
                          title={isBooked ? 'Already booked' : isPastTime ? 'Past time' : ''}
                          className={`flex flex-col items-center justify-center h-14 rounded-2xl text-xs font-bold transition-all active:scale-95 ${
                            active
                              ? 'bg-[#0254b7] text-white shadow-md shadow-blue-200'
                              : isBooked
                                ? 'bg-gray-50 text-gray-200 border border-gray-100 line-through'
                                : isPastTime
                                  ? 'bg-gray-50 text-gray-200 border border-gray-100'
                                  : 'bg-white text-gray-800 border border-gray-200 hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <span className="text-sm font-extrabold leading-tight">{fmt12(time).split(' ')[0]}</span>
                          <span className={`text-[10px] font-bold mt-0.5 ${active ? 'text-blue-200' : 'text-gray-400'}`}>{fmt12(time).split(' ')[1]}</span>
                          {isBooked ? <span className="text-[9px] text-red-300 font-bold mt-0.5">Booked</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {bookingSuccess ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="text-sm font-semibold text-emerald-800">{bookingSuccess}</span>
          </div>
        ) : null}
        {bookingError ? (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-sm font-semibold text-red-700">{bookingError}</span>
          </div>
        ) : null}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 shadow-[0_-8px_32px_rgba(0,0,0,0.06)] z-30 px-4 py-4">
        {selectedTime ? (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <svg className="w-4 h-4 text-[#0254b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {fmt12(selectedTime)}
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <svg className="w-4 h-4 text-[#0254b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {fmtDate(selectedDate)}
            </div>
          </div>
        ) : null}
        <button
          onClick={() => setShowConfirmation(true)}
          disabled={!canConfirm || booking}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
            canConfirm && !booking
              ? 'bg-[#0254b7] text-white shadow-lg shadow-blue-200'
              : 'bg-gray-100 text-gray-300'
          }`}
        >
          {booking ? 'Booking…' : canConfirm ? 'Confirm Appointment' : 'Select a date & time'}
        </button>
      </div>

      {/* Confirmation bottom sheet */}
      {showConfirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowConfirmation(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0254b7]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">Confirm Appointment</div>
                <div className="text-sm text-gray-400 font-medium">Review your booking details</div>
              </div>
            </div>

            {hasSameDayAppt && (
              <div className="flex items-start gap-2.5 bg-orange-50 rounded-2xl p-3.5 mb-4 border border-orange-100">
                <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-[13px] font-medium text-orange-700 leading-snug">You already have an appointment on this date. Booking another?</span>
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 mb-6 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3.5">
                <span className="text-sm font-medium text-gray-500">Doctor</span>
                <span className="text-sm font-bold text-gray-900">{doctorName}</span>
              </div>
              {activeMemberName && (
                <div className="flex justify-between items-center px-4 py-3.5">
                  <span className="text-sm font-medium text-gray-500">Patient</span>
                  <span className="text-sm font-bold text-gray-900">{activeMemberName}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-4 py-3.5">
                <span className="text-sm font-medium text-gray-500">Date</span>
                <span className="text-sm font-bold text-gray-900">{fmtDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3.5">
                <span className="text-sm font-medium text-gray-500">Time</span>
                <span className="text-sm font-bold text-[#0254b7]">{selectedTime ? fmt12(selectedTime) : '—'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={booking}
                className="flex-1 py-3 rounded-2xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={booking}
                className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#0254b7] text-white shadow-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Booking…
                  </>
                ) : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

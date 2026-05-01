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

  return (
    <div className="flex flex-col min-h-screen bg-[#fff] text-gray-900 pb-28 absolute inset-0 z-50">
      {/* Top Bar - Frosted Glass */}
      <TopHeader
        title="Book Appointment"
        backHref={isStaffFlow ? `/appointments/book?patientId=${encodeURIComponent(staffPatientId)}` : '/appointments/book'}
      />

      <div className="flex flex-col px-6 mt-10 gap-5 flex-1">

        {/* Simple Doctor Profile */}
        <div className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7] font-bold text-xl border border-blue-100 shadow-sm shrink-0">
            {doctorInitial}
          </div>

        {isStaffFlow ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-extrabold tracking-widest text-[#0254b7] uppercase">Booking for</div>
            <div className="mt-1 text-sm font-bold text-gray-900">
              {staffPatient?.fullName || staffPatientId || '—'}
            </div>
          </div>
        ) : null}
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 leading-tight tracking-tight">{doctorName}</h2>
            <div className="text-sm font-medium text-gray-500 mt-0.5">Specialist</div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="mt-10">
          <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1">
            Book Appointment
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-3 mt-10">Day</h3>

          {loadingDates ? <p className="text-sm font-medium text-gray-400">Loading available dates...</p> : null}
          {!loadingDates && dateChoices.every((d) => !d.available) ? (
            <p className="text-sm font-medium text-gray-400">No availability in the next 2 weeks.</p>
          ) : (
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
              {dateChoices.map((c) => {
                const active = c.iso === selectedDate;
                const disabled = !c.available;

                // Formulate "4 Oct" format
                const dObj = parseIsoDate(c.iso);
                const dayMatchText = `${dObj.getDate()} ${dObj.toLocaleDateString(undefined, { month: 'short' })}`;

                // Override dow to say "Today" if today
                let dowText = c.dow;
                if (c.iso === todayIso) dowText = 'Today';

                return (
                  <button
                    key={c.iso}
                    type="button"
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-[76px] h-[56px] rounded-[14px] font-bold transition-all ${active
                      ? 'bg-[#0254b7] text-white shadow-sm'
                      : disabled
                        ? 'bg-gray-50 text-gray-300 border border-gray-100'
                        : 'bg-white text-gray-900 border border-gray-200 hover:border-blue-200'
                      }`}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedDate(c.iso);
                    }}
                    disabled={disabled}
                  >
                    <span className={`text-[10px] uppercase tracking-widest ${active ? 'text-blue-100 font-medium' : disabled ? 'text-gray-300' : 'text-gray-500 font-medium'}`}>{dowText}</span>
                    <span className="text-sm mt-0.5">{dayMatchText}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Time Selection */}
        <div className="mt-10">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Time</h3>
          {loadingSlots ? <p className="text-sm font-medium text-gray-400">Loading availability...</p> : null}

          {doctorId && selectedDateAvailable && times.length === 0 && !loadingSlots ? (
            <p className="text-sm font-medium text-gray-400">No available slots for the selected date.</p>
          ) : doctorId && selectedDateAvailable ? (
            <div className="flex overflow-x-auto gap-3 pb-2 -mx-6 px-6 hide-scrollbar [&::-webkit-scrollbar]:hidden">
              {times.map((time) => {
                const isBooked = bookedSet.has(time);
                const isPastTime = selectedDate === todayIso && toMinutes(time) < nowMinutes;
                const disabled = isBooked || booking || isPastTime;
                const active = selectedTime === time;

                // Format "7:00 PM"
                const [h, m] = time.split(':');
                const hourNum = parseInt(h, 10);
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                const hour12 = hourNum % 12 || 12;
                const displayTimeStr = `${hour12}:${m} ${ampm}`;

                return (
                  <button
                    key={time}
                    type="button"
                    className={`flex-shrink-0 inline-flex items-center justify-center px-5 h-10 rounded-full text-sm font-bold transition-all ${active
                      ? 'bg-[#0254b7] text-white shadow-sm'
                      : disabled
                        ? 'bg-gray-50 text-gray-300 border border-gray-100'
                        : 'bg-white text-gray-900 border border-gray-200 hover:border-blue-200'
                      }`}
                    disabled={disabled}
                    onClick={() => setSelectedTime(time)}
                    title={isBooked ? 'Booked' : isPastTime ? 'Past time' : 'Select'}
                  >
                    {displayTimeStr}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {bookingSuccess ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-semibold">{bookingSuccess}</div> : null}
        {bookingError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">{bookingError}</div> : null}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-30 flex justify-center">
        <button
          onClick={() => setShowConfirmation(true)}
          disabled={!canConfirm || booking}
          className={`w-full max-w-[320px] py-2.5 rounded-2xl text-sm font-bold transition-transform active:scale-95 ${canConfirm && !booking
            ? 'bg-[#0254b7] text-white shadow-md'
            : 'bg-gray-100 text-gray-400 shadow-transparent'
            }`}
        >
          {booking ? 'Booking...' : 'Make Appointment'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#0254b7] mb-4 mx-auto">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirm Appointment</h3>

            {hasSameDayAppt && (
              <div className="bg-orange-50 rounded-xl p-3 mb-2 mt-4 border border-orange-100">
                <span className="text-[13px] font-medium text-orange-800 leading-snug block text-center">
                  You already have an appointment scheduled for this date. Are you sure you want to book another?
                </span>
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-4 mb-6 mt-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-500">Doctor</span>
                <span className="text-sm font-bold text-gray-900">{doctorName}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-500">Date</span>
                <span className="text-sm font-bold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">Time</span>
                <span className="text-sm font-bold text-[#0254b7]">
                  {(() => {
                    if (!selectedTime) return '';
                    const [h, m] = selectedTime.split(':');
                    const hourNum = parseInt(h, 10);
                    return `${hourNum % 12 || 12}:${m} ${hourNum >= 12 ? 'PM' : 'AM'}`;
                  })()}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                disabled={booking}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0254b7] text-white shadow-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                disabled={booking}
              >
                {booking ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Booking...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

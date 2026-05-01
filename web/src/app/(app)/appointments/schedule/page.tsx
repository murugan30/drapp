'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { apiFetch } from '../../../../lib/api';
import styles from '../appointments.module.css';

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

function startOfWeekMonday(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  const diff = (day + 6) % 7;
  out.setDate(out.getDate() - diff);
  return out;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export default function ScheduleAppointmentPage() {
  const router = useRouter();
  const { user } = useAuth();

  const todayIso = localTodayIso();

  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<DoctorPublic[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctorSheetOpen, setDoctorSheetOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [booked, setBooked] = useState<BookedAppointment[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);

  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user || user.role !== 'patient') return;

      const storageKey = `activeMemberId:${user.id}`;
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      setActiveMemberId(stored);

      const [m, d] = await Promise.all([
        apiFetch<Member[]>('/patients/my'),
        apiFetch<DoctorPublic[]>('/users/doctors-public'),
      ]);
      setMembers(m || []);
      setDoctors(d || []);
    };
    void load();
  }, [user]);

  useEffect(() => {
    if (selectedDate < todayIso) {
      setSelectedDate(todayIso);
    }
  }, [selectedDate, todayIso]);

  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate, selectedDoctorId]);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const stepMinutes = selectedDoctor?.slotMinutes || DEFAULT_SLOT_MINUTES;

  const activeMemberName = useMemo(() => {
    if (!activeMemberId) return null;
    return members.find((m) => m._id === activeMemberId)?.fullName || null;
  }, [activeMemberId, members]);

  const selectedDoctorName = selectedDoctor?.name || 'Select doctor';
  const selectedDoctorInitial = (selectedDoctorName?.trim?.()?.[0] || 'D').toUpperCase();

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => d.name.toLowerCase().includes(q));
  }, [doctorSearch, doctors]);

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
    if (!selectedDoctorId) return false;
    return availableDateSet.has(selectedDate);
  }, [availableDateSet, selectedDate, selectedDoctorId]);

  useEffect(() => {
    const loadAvailabilityWindow = async () => {
      if (!user || user.role !== 'patient') return;
      if (!selectedDoctorId) {
        setSlots([]);
        setBooked([]);
        return;
      }
      setLoadingDates(true);
      setBookingError(null);
      setBookingSuccess(null);
      try {
        const from = todayIso;
        const to = formatIsoDate(addDays(parseIsoDate(todayIso), DATE_WINDOW_DAYS - 1));
        const s = await apiFetch<AvailabilitySlot[]>(
          `/availability/slots?doctorId=${encodeURIComponent(selectedDoctorId)}&from=${from}&to=${to}`,
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
  }, [selectedDoctorId, todayIso, user]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    if (selectedDate < todayIso) {
      setSelectedDate(todayIso);
      return;
    }
    if (!availableDateSet.has(selectedDate)) {
      const first = dateChoices.find((d) => d.available)?.iso;
      if (first) setSelectedDate(first);
    }
  }, [availableDateSet, dateChoices, selectedDate, selectedDoctorId, todayIso]);

  useEffect(() => {
    const loadBookedForDate = async () => {
      if (!user || user.role !== 'patient') return;
      if (!selectedDoctorId) return;
      if (!selectedDateAvailable) {
        setBooked([]);
        return;
      }
      setLoadingSlots(true);
      setBookingError(null);
      setBookingSuccess(null);
      try {
        const b = await apiFetch<BookedAppointment[]>(
          `/appointments/booked?doctorId=${encodeURIComponent(selectedDoctorId)}&date=${selectedDate}`,
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
  }, [selectedDate, selectedDateAvailable, selectedDoctorId, user]);

  const bookedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of booked || []) {
      const d = new Date(b.scheduledAt);
      set.add(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    }
    return set;
  }, [booked]);

  const times = useMemo(() => {
    if (!selectedDoctorId) return [] as string[];
    const unique = new Set<string>();
    for (const s of slots || []) {
      if (s.date !== selectedDate) continue;
      for (const t of buildTimesForSlot(s, stepMinutes)) {
        unique.add(t);
      }
    }
    return Array.from(unique).sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [selectedDate, selectedDoctorId, slots, stepMinutes]);

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

  const canConfirm = !!activeMemberId && !!selectedDoctorId && !!selectedTime;

  const handleConfirm = async () => {
    if (!user || user.role !== 'patient') return;
    if (!activeMemberId) {
      setBookingError('Please select an active member in Members first');
      return;
    }
    if (!selectedDoctorId) {
      setBookingError('Please select a doctor');
      return;
    }
    if (!selectedTime) return;

    setBooking(true);
    setBookingError(null);
    setBookingSuccess(null);
    try {
      const scheduledAt = makeLocalIsoWithOffset(selectedDate, selectedTime);
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          patientId: activeMemberId,
          scheduledAt,
        }),
      });
      setBookingSuccess(`Booked at ${selectedTime}`);
      setSelectedTime(null);
      // Go back to list screen.
      setTimeout(() => router.push('/appointments'), 400);
    } catch (e: any) {
      setBookingError(e?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.headerBar}>
        <button type="button" className={styles.backButton} onClick={() => router.push('/appointments')} aria-label="Back">
          <span className={styles.backIcon} aria-hidden="true" />
          Back
        </button>
        <div className={styles.bookingTitle}>Schedule</div>
        <span className={styles.pill}>Appointment</span>
      </header>

      <div className={styles.card}>
        <div className={styles.bookingHeader}>
          <div>
            <div className={styles.bookingTitle}>Book appointment</div>
            <div className={styles.bookingSub}>Choose doctor, date and time</div>
          </div>
          <span className={styles.memberPill}>{activeMemberName ? `Member: ${activeMemberName}` : 'No active member'}</span>
        </div>

        <div className={styles.doctorSelectRow}>
          <div className={styles.doctorSelectLeft}>
            <div className={styles.doctorAvatar}>{selectedDoctorInitial}</div>
            <div className={styles.doctorSelectText}>
              <div className={styles.doctorSelectName}>{selectedDoctorName}</div>
              <div className={styles.doctorSelectMeta}>{selectedDoctorId ? `Slot: ${stepMinutes} mins` : 'Tap change to select'}</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.changeBtn}
            onClick={() => {
              setDoctorSearch('');
              setDoctorSheetOpen(true);
            }}
          >
            {selectedDoctorId ? 'Change' : 'Select'}
          </button>
        </div>

        <div className={styles.summaryRow}>
          <div className={styles.upcomingMeta}>Step: {stepMinutes} mins</div>
          {selectedDoctorId ? (
            <span className={styles.summaryPill}>{selectedDate}</span>
          ) : (
            <span className={styles.pillMuted}>Select doctor</span>
          )}
        </div>

        {!selectedDoctorId ? <p className={styles.textMuted}>Select a doctor to see available dates.</p> : null}

        {selectedDoctorId ? (
          <div className={styles.dateBar}>
            {loadingDates ? <p className={styles.textMuted}>Loading available dates...</p> : null}
            {!loadingDates && dateChoices.every((d) => !d.available) ? (
              <p className={styles.textMuted}>No availability in the next 2 weeks.</p>
            ) : (
              <div className={styles.dateStrip}>
                {dateChoices.map((c) => {
                  const active = c.iso === selectedDate;
                  const disabled = !c.available;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      className={`${styles.dateChip} ${active ? styles.dateChipActive : ''} ${disabled ? styles.dateChipUnavailable : ''}`}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedDate(c.iso);
                      }}
                      disabled={disabled}
                    >
                      <div className={styles.dateChipDow}>{c.dow}</div>
                      <div className={styles.dateChipDay}>{c.day}</div>
                      {!c.available ? <div className={styles.dateChipMeta}>Unavailable</div> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {selectedDoctorId && !selectedDateAvailable && !loadingDates ? (
          <p className={styles.textMuted}>Doctor is unavailable on this date.</p>
        ) : null}

        {loadingSlots ? <p className={styles.textMuted}>Loading availability...</p> : null}

        {selectedDoctorId && selectedDateAvailable && times.length === 0 && !loadingSlots ? (
          <p className={styles.textMuted}>No available slots for the selected date.</p>
        ) : selectedDoctorId && selectedDateAvailable ? (
          <div className={styles.timeGroups}>
            {timeGroups
              .filter((g) => g.times.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <div className={styles.timeGroupTitle}>{g.label}</div>
                  <div className={styles.timeChips}>
                    {g.times.map((time) => {
                      const isBooked = bookedSet.has(time);
                      const isPastTime = selectedDate === todayIso && toMinutes(time) < nowMinutes;
                      const disabled = isBooked || booking || isPastTime;
                      const active = selectedTime === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          className={`${styles.timeChip} ${active ? styles.timeChipActive : ''} ${
                            disabled ? styles.timeChipDisabled : ''
                          }`}
                          disabled={disabled}
                          onClick={() => setSelectedTime(time)}
                          title={isBooked ? 'Booked' : isPastTime ? 'Past time' : 'Select'}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

            <div className={styles.confirmRow}>
              <button
                type="button"
                className={styles.buttonGhost}
                onClick={() => setSelectedTime(null)}
                disabled={!selectedTime || booking}
              >
                Clear
              </button>
              <button type="button" className={styles.button} onClick={handleConfirm} disabled={!canConfirm || booking}>
                {booking ? 'Booking...' : selectedTime ? `Confirm ${selectedTime}` : 'Select a time'}
              </button>
            </div>
          </div>
        ) : null}

        {bookingSuccess ? <div className={styles.bannerSuccess}>{bookingSuccess}</div> : null}
        {bookingError ? <div className={styles.bannerError}>{bookingError}</div> : null}
      </div>

      {user?.role === 'patient' && doctorSheetOpen ? (
        <div className={styles.sheetOverlay} role="button" tabIndex={0} onClick={() => setDoctorSheetOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHandle} />
              <div className={styles.sheetTitle}>Select doctor</div>
              <input
                className={styles.sheetSearch}
                placeholder="Search doctor"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
              />
            </div>
            <div className={styles.doctorList}>
              {filteredDoctors.map((d) => {
                const active = d.id === selectedDoctorId;
                const initial = (d.name?.trim?.()?.[0] || 'D').toUpperCase();
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`${styles.doctorRow} ${active ? styles.doctorRowActive : ''}`}
                    onClick={() => {
                      setSelectedDoctorId(d.id);
                      setDoctorSheetOpen(false);
                    }}
                  >
                    <div className={styles.doctorRowLeft}>
                      <div className={styles.doctorAvatar}>{initial}</div>
                      <div className={styles.doctorRowText}>
                        <div className={styles.doctorRowName}>{d.name}</div>
                        <div className={styles.doctorRowMeta}>Slot: {d.slotMinutes || DEFAULT_SLOT_MINUTES} mins</div>
                      </div>
                    </div>
                    <span className={styles.pill}>{active ? 'Selected' : 'Choose'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

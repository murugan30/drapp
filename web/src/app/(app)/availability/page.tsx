'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';
import styles from './availability.module.css';

type Slot = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CAL_START_HOUR = 6;
const CAL_END_HOUR = 22;
const PX_PER_MIN = 1;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toDateString(start), to: toDateString(end) };
}

function buildTimes(stepMinutes: number) {
  const step = clamp(stepMinutes || 15, 5, 60);
  const result: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += step) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    result.push(`${h}:${m}`);
  }
  return result;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map((v) => Number(v));
  return h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export default function AvailabilityPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useAuth();

  const canView = user?.role === 'admin' || user?.role === 'doctor';

  const slotMinutes = typeof user?.slotMinutes === 'number' ? user.slotMinutes : 15;
  const slotStep = clamp(slotMinutes || 15, 5, 60);
  const timeOptions = useMemo(() => buildTimes(slotMinutes), [slotMinutes]);

  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateString(new Date()));

  const [monthSlots, setMonthSlots] = useState<Record<string, Slot[]>>({});
  const [daySlots, setDaySlots] = useState<Slot[]>([]);
  const [slotPreview, setSlotPreview] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [pendingSlot, setPendingSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('10:00');

  const [recurring, setRecurring] = useState(false);
  const [repeatDays, setRepeatDays] = useState(7);

  const [drag, setDrag] = useState<
    | null
    | {
        mode: 'create' | 'move' | 'resize';
        startMin: number;
        currentMin: number;
        slotId?: string;
        originalStartMin?: number;
        originalEndMin?: number;
      }
  >(null);

  useEffect(() => {
    if (!user) return;
    if (!canView) {
      router.push('/dashboard');
    }
  }, [canView, router, user]);

  const loadMonth = async (d: Date) => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthRange(d);
      const slots = await apiFetch<Slot[]>(`/availability/slots/me?from=${from}&to=${to}`);
      const grouped: Record<string, Slot[]> = {};
      for (const s of slots || []) {
        grouped[s.date] = grouped[s.date] || [];
        grouped[s.date].push(s);
      }
      for (const key of Object.keys(grouped)) {
        grouped[key] = grouped[key].slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
      setMonthSlots(grouped);
    } catch (e: any) {
      setError(e?.message || 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  };

  const loadDay = async (date: string) => {
    if (!canView) return;
    setError(null);
    try {
      const slots = await apiFetch<Slot[]>(`/availability/slots/me?from=${date}&to=${date}`);
      setDaySlots((slots || []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (e: any) {
      setError(e?.message || 'Failed to load day slots');
    }
  };

  useEffect(() => {
    void loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, month.getFullYear(), month.getMonth()]);

  useEffect(() => {
    void loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, selectedDate]);

  const createSlot = async () => {
    if (!canView) return;
    if (!pendingSlot) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/availability/slots/me', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          startTime: pendingSlot.startTime,
          endTime: pendingSlot.endTime,
          timezone: 'Asia/Kolkata',
          recurring,
          repeatDays: recurring ? repeatDays : undefined,
        }),
      });
      await loadMonth(month);
      await loadDay(selectedDate);
      setPendingSlot(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to create slot');
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = async (slotId: string, startTime: string, endTime: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/availability/slots/me/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ startTime, endTime }),
      });
      await loadMonth(month);
      await loadDay(selectedDate);
    } catch (e: any) {
      setError(e?.message || 'Failed to update slot');
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slotId: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/availability/slots/me/${slotId}`, { method: 'DELETE' });
      await loadMonth(month);
      await loadDay(selectedDate);
      setEditingSlotId(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete slot');
    } finally {
      setSaving(false);
    }
  };

  const calendarStartMin = CAL_START_HOUR * 60;
  const calendarEndMin = CAL_END_HOUR * 60;
  const totalMinutes = calendarEndMin - calendarStartMin;
  const timelineHeight = totalMinutes * PX_PER_MIN;

  const snapMinute = (minute: number) => {
    const snapped = Math.round(minute / slotStep) * slotStep;
    return clamp(snapped, calendarStartMin, calendarEndMin);
  };

  const minuteFromPointer = (clientY: number) => {
    const el = timelineRef.current;
    if (!el) return calendarStartMin;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;
    const raw = calendarStartMin + y / PX_PER_MIN;
    return snapMinute(raw);
  };

  const beginCreate = (clientY: number) => {
    const m = minuteFromPointer(clientY);
    setDrag({ mode: 'create', startMin: m, currentMin: m });
    setPendingSlot(null);
    setEditingSlotId(null);
  };

  const commitDragCreate = (d: NonNullable<typeof drag>) => {
    const a = Math.min(d.startMin, d.currentMin);
    const b = Math.max(d.startMin, d.currentMin);
    if (b - a < slotStep) {
      setDrag(null);
      return;
    }
    setPendingSlot({ startTime: minutesToTime(a), endTime: minutesToTime(b) });
    setDrag(null);
  };

  const startMove = (slot: Slot, clientY: number) => {
    const startMin = minuteFromPointer(clientY);
    const originalStartMin = timeToMinutes(slot.startTime);
    const originalEndMin = timeToMinutes(slot.endTime);
    setDrag({
      mode: 'move',
      startMin,
      currentMin: startMin,
      slotId: slot._id,
      originalStartMin,
      originalEndMin,
    });
  };

  const startResize = (slot: Slot, clientY: number) => {
    const startMin = minuteFromPointer(clientY);
    const originalStartMin = timeToMinutes(slot.startTime);
    const originalEndMin = timeToMinutes(slot.endTime);
    setDrag({
      mode: 'resize',
      startMin,
      currentMin: startMin,
      slotId: slot._id,
      originalStartMin,
      originalEndMin,
    });
  };

  const commitDragUpdate = async (d: NonNullable<typeof drag>) => {
    if (!d.slotId || d.originalStartMin == null || d.originalEndMin == null) {
      setDrag(null);
      return;
    }

    const pointerDelta = d.currentMin - d.startMin;
    let nextStart = d.originalStartMin;
    let nextEnd = d.originalEndMin;

    if (d.mode === 'move') {
      nextStart = snapMinute(d.originalStartMin + pointerDelta);
      nextEnd = snapMinute(d.originalEndMin + pointerDelta);

      const duration = d.originalEndMin - d.originalStartMin;
      if (nextEnd - nextStart !== duration) {
        nextEnd = clamp(nextStart + duration, calendarStartMin, calendarEndMin);
      }
    }

    if (d.mode === 'resize') {
      nextStart = d.originalStartMin;
      nextEnd = clamp(snapMinute(d.originalEndMin + pointerDelta), nextStart + slotStep, calendarEndMin);
    }

    const startTime = minutesToTime(nextStart);
    const endTime = minutesToTime(nextEnd);

    setSlotPreview((p) => ({ ...p, [d.slotId!]: { startTime, endTime } }));
    setDrag(null);

    try {
      await updateSlot(d.slotId, startTime, endTime);
    } finally {
      setSlotPreview((p) => {
        const next = { ...p };
        delete next[d.slotId!];
        return next;
      });
    }
  };

  if (!canView) return null;

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstGridDay = new Date(monthStart);
  firstGridDay.setDate(firstGridDay.getDate() - firstGridDay.getDay());
  const gridDays = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(firstGridDay);
    d.setDate(firstGridDay.getDate() + i);
    return d;
  });

  const selected = new Date(`${selectedDate}T00:00:00`);
  const selectedLabel = `${weekday[selected.getDay()]} ${selectedDate}`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.topbar}>
        <div>
          <h2>{t('availability')}</h2>
          <p className={styles.textMuted}>Pick a date and add one or more availability slots.</p>
        </div>
        <div className={styles.topbarRight}>
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            Prev
          </button>
          <div className={styles.monthTitle}>
            {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <button
            className={styles.buttonGhost}
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.gridTwo}>
        <div className={styles.card}>
          <div className={styles.weekHeader}>
            {weekday.map((d) => (
              <div key={d} className={styles.weekDay}>
                {d}
              </div>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {gridDays.map((d) => {
              const dateStr = toDateString(d);
              const isCurrentMonth = d.getMonth() === month.getMonth();
              const isSelected = dateStr === selectedDate;
              const hasSlots = (monthSlots[dateStr]?.length || 0) > 0;

              return (
                <button
                  key={dateStr}
                  className={`${styles.dayCell} ${isCurrentMonth ? '' : styles.dayCellMuted} ${isSelected ? styles.dayCellSelected : ''}`}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <div className={styles.dayNumber}>{d.getDate()}</div>
                  {hasSlots ? <div className={styles.dotRow}><span className={styles.dot} /></div> : null}
                </button>
              );
            })}
          </div>
          <div className={styles.datePickerRow}>
            <input
              className={styles.dateInput}
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            {loading ? <span className={styles.textMuted}>Loading…</span> : null}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <h3 className={styles.cardTitle}>{selectedLabel}</h3>
            <div className={styles.meta}>Slot step: {slotStep} mins</div>
          </div>

          {pendingSlot ? (
            <div className={styles.pendingPanel}>
              <div className={styles.pendingTitle}>New slot</div>
              <div className={styles.pendingRow}>
                <div className={styles.pendingTimes}>
                  {pendingSlot.startTime} - {pendingSlot.endTime}
                </div>
                <button className={styles.button} type="button" onClick={createSlot} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className={styles.buttonGhost}
                  type="button"
                  onClick={() => setPendingSlot(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
              <div className={styles.recRow}>
                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
                  Recurring (copy to next days)
                </label>
                {recurring ? (
                  <div className={styles.repeatRow}>
                    <input
                      className={styles.repeatInput}
                      type="number"
                      min={1}
                      max={60}
                      value={repeatDays}
                      onChange={(e) => setRepeatDays(Number(e.target.value || 7))}
                    />
                    <span className={styles.textMuted}>days</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {editingSlotId ? (
            <div className={styles.editPanel}>
              <div className={styles.pendingTitle}>Edit slot</div>
              <div className={styles.pendingRow}>
                <select className={styles.select} value={editStart} onChange={(e) => setEditStart(e.target.value)}>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className={styles.to}>to</span>
                <select className={styles.select} value={editEnd} onChange={(e) => setEditEnd(e.target.value)}>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => updateSlot(editingSlotId, editStart, editEnd)}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className={styles.buttonDanger}
                  type="button"
                  onClick={() => deleteSlot(editingSlotId)}
                  disabled={saving}
                >
                  Delete
                </button>
                <button
                  className={styles.buttonGhost}
                  type="button"
                  onClick={() => setEditingSlotId(null)}
                  disabled={saving}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.timelineWrap}>
            <div className={styles.timeCol}>
              {Array.from({ length: CAL_END_HOUR - CAL_START_HOUR + 1 }).map((_, i) => {
                const h = CAL_START_HOUR + i;
                return (
                  <div key={h} className={styles.timeLabel} style={{ height: 60 * PX_PER_MIN }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                );
              })}
            </div>

            <div
              className={styles.track}
              ref={timelineRef}
              style={{ height: "100%" }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                beginCreate(e.clientY);
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag) return;
                const m = minuteFromPointer(e.clientY);
                setDrag((prev) => (prev ? { ...prev, currentMin: m } : prev));
              }}
              onPointerUp={(e) => {
                void e;
                if (!drag) return;
                if (drag.mode === 'create') {
                  commitDragCreate(drag);
                  return;
                }
                void commitDragUpdate(drag);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              <div className={styles.trackInner} style={{ height: timelineHeight }}>
                {Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }).map((_, i) => (
                  <div
                    key={i}
                    className={styles.hourLine}
                    style={{ top: i * 60 * PX_PER_MIN }}
                  />
                ))}

                {daySlots.map((s) => {
                  const preview = slotPreview[s._id];
                  const startTime = preview?.startTime || s.startTime;
                  const endTime = preview?.endTime || s.endTime;
                  const startMin = timeToMinutes(startTime);
                  const endMin = timeToMinutes(endTime);
                  const top = (startMin - calendarStartMin) * PX_PER_MIN;
                  const height = Math.max((endMin - startMin) * PX_PER_MIN, slotStep * PX_PER_MIN);

                  return (
                    <div
                      key={s._id}
                      className={styles.slotBlock}
                      style={{ top, height }}
                      role="button"
                      tabIndex={0}
                      onDoubleClick={() => {
                        setEditingSlotId(s._id);
                        setEditStart(startTime);
                        setEditEnd(endTime);
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        startMove(s, e.clientY);
                        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                      }}
                    >
                      <div
                        className={styles.slotLabel}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSlotId(s._id);
                          setEditStart(startTime);
                          setEditEnd(endTime);
                        }}
                      >
                        {startTime} - {endTime}
                      </div>
                      <div
                        className={styles.resizeHandle}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          startResize(s, e.clientY);
                          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                        }}
                      />
                    </div>
                  );
                })}

                {drag && drag.mode === 'create' ? (
                  (() => {
                    const a = Math.min(drag.startMin, drag.currentMin);
                    const b = Math.max(drag.startMin, drag.currentMin);
                    const top = (a - calendarStartMin) * PX_PER_MIN;
                    const height = Math.max((b - a) * PX_PER_MIN, slotStep * PX_PER_MIN);
                    return <div className={styles.pendingBlock} style={{ top, height }} />;
                  })()
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.hint}>Tip: drag on the timeline to create a slot. Double-click a slot to edit.</div>
        </div>
      </div>
    </div>
  );
}

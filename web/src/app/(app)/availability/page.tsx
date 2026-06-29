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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  const [quickStart, setQuickStart] = useState('09:00');
  const [quickEnd, setQuickEnd] = useState('10:00');

  const [dragCreateMode, setDragCreateMode] = useState(false);

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

  const quickPreview = useMemo(() => {
    if (pendingSlot) return null;
    const a = timeToMinutes(quickStart);
    const b = timeToMinutes(quickEnd);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (b <= a) return null;

    const startMin = clamp(a, calendarStartMin, calendarEndMin);
    const endMin = clamp(b, calendarStartMin, calendarEndMin);
    if (endMin <= startMin) return null;

    const top = (startMin - calendarStartMin) * PX_PER_MIN;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, slotStep * PX_PER_MIN);
    return { top, height, startTime: minutesToTime(startMin), endTime: minutesToTime(endMin) };
  }, [calendarEndMin, calendarStartMin, pendingSlot, quickEnd, quickStart, slotStep]);

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

  const openEdit = (slot: Slot, startTime: string, endTime: string) => {
    setEditingSlotId(slot._id);
    setEditStart(startTime);
    setEditEnd(endTime);
    setPendingSlot(null);

    queueMicrotask(() => {
      const el = document.getElementById(`slot-row-${slot._id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const setQuickStartAndEnsureEnd = (startTime: string) => {
    setQuickStart(startTime);
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(quickEnd);
    if (endMin <= startMin) {
      setQuickEnd(minutesToTime(clamp(startMin + slotStep, 0, 24 * 60 - slotStep)));
    }
  };

  const setQuickEndAndEnsureAfterStart = (endTime: string) => {
    setQuickEnd(endTime);
    const startMin = timeToMinutes(quickStart);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      setQuickStart(minutesToTime(clamp(endMin - slotStep, 0, 24 * 60 - slotStep)));
    }
  };

  const setEditStartAndEnsureEnd = (startTime: string) => {
    setEditStart(startTime);
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(editEnd);
    if (endMin <= startMin) {
      setEditEnd(minutesToTime(clamp(startMin + slotStep, 0, 24 * 60 - slotStep)));
    }
  };

  const setEditEndAndEnsureAfterStart = (endTime: string) => {
    setEditEnd(endTime);
    const startMin = timeToMinutes(editStart);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      setEditStart(minutesToTime(clamp(endMin - slotStep, 0, 24 * 60 - slotStep)));
    }
  };

  const dragTimes = useMemo(() => {
    if (!drag) return null;
    const calendarStartMin = CAL_START_HOUR * 60;
    const calendarEndMin = CAL_END_HOUR * 60;

    const snap = (minute: number) => {
      const snapped = Math.round(minute / slotStep) * slotStep;
      return clamp(snapped, calendarStartMin, calendarEndMin);
    };

    if (drag.mode === 'create') {
      const a = Math.min(drag.startMin, drag.currentMin);
      const b = Math.max(drag.startMin, drag.currentMin);
      return { startMin: snap(a), endMin: snap(b) };
    }

    if (!drag.slotId || drag.originalStartMin == null || drag.originalEndMin == null) return null;
    const pointerDelta = drag.currentMin - drag.startMin;
    let nextStart = drag.originalStartMin;
    let nextEnd = drag.originalEndMin;

    if (drag.mode === 'move') {
      nextStart = snap(drag.originalStartMin + pointerDelta);
      nextEnd = snap(drag.originalEndMin + pointerDelta);
      const duration = drag.originalEndMin - drag.originalStartMin;
      if (nextEnd - nextStart !== duration) {
        nextEnd = clamp(nextStart + duration, calendarStartMin, calendarEndMin);
      }
    }

    if (drag.mode === 'resize') {
      nextStart = drag.originalStartMin;
      nextEnd = clamp(snap(drag.originalEndMin + pointerDelta), nextStart + slotStep, calendarEndMin);
    }

    return { startMin: nextStart, endMin: nextEnd };
  }, [drag, slotStep]);

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

  const daySummary = useMemo(() => {
    const count = daySlots.length;
    const minutes = daySlots.reduce((sum, s) => {
      const a = timeToMinutes(s.startTime);
      const b = timeToMinutes(s.endTime);
      return sum + Math.max(0, b - a);
    }, 0);
    const hours = Math.round((minutes / 60) * 10) / 10;
    return { count, hours };
  }, [daySlots]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerActionsRow}>
        <button
          className={styles.buttonGhost}
          type="button"
          onClick={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            setSelectedDate(toDateString(now));
          }}
        >
          Today
        </button>
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

          <div className={styles.summaryRow}>
            <div className={styles.summaryChip}>
              <span className={styles.summaryLabel}>Slots</span>
              <span className={styles.summaryValue}>{daySummary.count}</span>
            </div>
            <div className={styles.summaryChip}>
              <span className={styles.summaryLabel}>Total</span>
              <span className={styles.summaryValue}>{daySummary.hours}h</span>
            </div>
          </div>

          {!pendingSlot ? (
            <div className={styles.addBox}>
              <div className={styles.addTitle}>Add slot</div>
              <div className={styles.addRow}>
                <select className={styles.select} value={quickStart} onChange={(e) => setQuickStartAndEnsureEnd(e.target.value)}>
                  {timeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <span className={styles.to}>to</span>
                <select className={styles.select} value={quickEnd} onChange={(e) => setQuickEndAndEnsureAfterStart(e.target.value)}>
                  {timeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => {
                    const a = timeToMinutes(quickStart);
                    const b = timeToMinutes(quickEnd);
                    if (b - a < slotStep) return;
                    setPendingSlot({ startTime: quickStart, endTime: quickEnd });
                    setEditingSlotId(null);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ) : null}

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
              className={`${styles.track} ${dragCreateMode ? styles.trackCreateMode : ''}`}
              ref={timelineRef}
              style={{ height: "100%" }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (dragCreateMode) {
                  beginCreate(e.clientY);
                  (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                  return;
                }

                const m = minuteFromPointer(e.clientY);
                const startTime = minutesToTime(m);
                const endTime = minutesToTime(clamp(m + slotStep, 0, 24 * 60 - slotStep));
                setQuickStart(startTime);
                setQuickEnd(endTime);
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

                {quickPreview ? (
                  <div
                    className={styles.quickPreviewBlock}
                    style={{ top: quickPreview.top, height: quickPreview.height }}
                    aria-hidden="true"
                    title={`${quickPreview.startTime} - ${quickPreview.endTime}`}
                  />
                ) : null}

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
                      className={`${styles.slotBlock} ${editingSlotId === s._id ? styles.slotBlockActive : ''}`}
                      style={{ top, height }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(s, startTime, endTime)}
                    >
                      <div className={styles.slotGrip}>
                        <div
                          className={styles.slotGripBar}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            startMove(s, e.clientY);
                            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                          }}
                        />
                      </div>

                      <div className={styles.slotLabel}>
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

                {dragTimes ? (
                  (() => {
                    const top = (dragTimes.startMin - calendarStartMin) * PX_PER_MIN;
                    return (
                      <div className={styles.dragPill} style={{ top }}>
                        {minutesToTime(dragTimes.startMin)} - {minutesToTime(dragTimes.endMin)}
                      </div>
                    );
                  })()
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.hintRow}>
            <div className={styles.hint}>Tip: tap a slot to edit. Drag the small bar to move. Drag the bottom handle to resize.</div>
            <button
              type="button"
              className={`${styles.buttonGhost} ${dragCreateMode ? styles.buttonGhostActive : ''}`}
              onClick={() => setDragCreateMode((v) => !v)}
            >
              {dragCreateMode ? 'Drag add: ON' : 'Drag add: OFF'}
            </button>
          </div>

          {daySlots.length === 0 ? (
            <div className={styles.empty}>No slots added for this day.</div>
          ) : (
            <div className={styles.slotList}>
              {daySlots.map((s) => (
                <div
                  key={s._id}
                  id={`slot-row-${s._id}`}
                  className={`${styles.slotRow} ${editingSlotId === s._id ? styles.slotRowActive : ''}`}
                >
                  <div className={styles.slotTime}>
                    {s.startTime} - {s.endTime}
                  </div>

                  {editingSlotId === s._id ? (
                    <div className={styles.slotEdit}>
                      <select
                        className={styles.select}
                        value={editStart}
                        onChange={(e) => setEditStartAndEnsureEnd(e.target.value)}
                        disabled={saving}
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className={styles.to}>to</span>
                      <select
                        className={styles.select}
                        value={editEnd}
                        onChange={(e) => setEditEndAndEnsureAfterStart(e.target.value)}
                        disabled={saving}
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <button
                        className={styles.button}
                        type="button"
                        onClick={() => updateSlot(s._id, editStart, editEnd)}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        className={styles.buttonGhost}
                        type="button"
                        onClick={() => setEditingSlotId(null)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.buttonDanger}
                        type="button"
                        onClick={() => void deleteSlot(s._id)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className={styles.slotActions}>
                      <button
                        type="button"
                        className={styles.buttonGhost}
                        onClick={() => openEdit(s, s.startTime, s.endTime)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.buttonDanger}
                        onClick={() => void deleteSlot(s._id)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

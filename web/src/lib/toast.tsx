'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ToastKind = 'error' | 'success' | 'info';

export type ToastInput = {
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number;
};

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  createdAt: number;
  durationMs: number;
};

type ToastContextValue = {
  show: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

declare global {
  // eslint-disable-next-line no-var
  var __drapp_toast: undefined | ((toast: ToastInput) => void);
  // eslint-disable-next-line no-var
  var __drapp_toast_queue: undefined | ToastInput[];
}

if (typeof window !== 'undefined') {
  globalThis.__drapp_toast_queue = globalThis.__drapp_toast_queue || [];
  if (typeof globalThis.__drapp_toast !== 'function') {
    globalThis.__drapp_toast = (toast: ToastInput) => {
      globalThis.__drapp_toast_queue?.push(toast);
    };
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultDuration(kind: ToastKind) {
  if (kind === 'error') return 5000;
  return 3500;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, 'id' | 'createdAt'>) => {
      const id = makeId();
      const item: ToastItem = {
        id,
        createdAt: Date.now(),
        durationMs: toast.durationMs,
        kind: toast.kind,
        title: toast.title,
        message: toast.message,
      };
      setItems((prev) => [item, ...prev].slice(0, 3));
      const timer = setTimeout(() => remove(id), toast.durationMs);
      timers.current.set(id, timer);
    },
    [remove],
  );

  const emit = useCallback(
    (toast: ToastInput) => {
      show({
        kind: toast.kind,
        title: toast.title,
        message: toast.message,
        durationMs: typeof toast.durationMs === 'number' ? toast.durationMs : defaultDuration(toast.kind),
      });
    },
    [show],
  );

  useEffect(() => {
    globalThis.__drapp_toast = emit;
    const queued = globalThis.__drapp_toast_queue || [];
    if (queued.length > 0) {
      globalThis.__drapp_toast_queue = [];
      queued.forEach((t) => emit(t));
    }
    return () => {
      const current = globalThis.__drapp_toast;
      if (current === emit) {
        delete globalThis.__drapp_toast;
      }
    };
  }, [emit]);

  const ctx = useMemo<ToastContextValue>(() => {
    return {
      show,
      error: (message, title) => show({ kind: 'error', title, message, durationMs: 5000 }),
      success: (message, title) => show({ kind: 'success', title, message, durationMs: 3500 }),
      info: (message, title) => show({ kind: 'info', title, message, durationMs: 3500 }),
    };
  }, [show]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[420px] max-w-[calc(100vw-2rem)]">
        {items.map((t) => {
          const base = 'rounded-xl shadow-lg px-4 py-3 bg-zinc-900 text-white';
          const dot =
            t.kind === 'error'
              ? 'bg-red-500'
              : t.kind === 'success'
                ? 'bg-emerald-500'
                : 'bg-blue-500';

          return (
            <div key={t.id} className={base} role="status">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                <div className="flex-1 min-w-0">
                  {t.title ? (
                    <div className="text-[12px] font-semibold leading-4 text-white/90">
                      {t.title}
                    </div>
                  ) : null}
                  <div className="text-[13px] leading-5 text-white/80 whitespace-pre-wrap break-words">
                    {t.message}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-white/60 hover:text-white transition-colors"
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

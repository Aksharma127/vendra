"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Tone = "success" | "info" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{ toast: (message: string, tone?: Tone) => void } | null>(null);

const LIFETIME_MS = 5000;

/**
 * Confirmation toasts for in-place actions ("Approved KIGM-PR-2026-00225").
 * Lives in the app layout, so a toast survives the router.refresh() that
 * follows every workflow action. Announced politely to screen readers; the
 * timer pauses while hovered or focused so it can actually be read.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, tone: Tone = "success") => {
    const id = nextId.current++;
    // Keep at most three on screen; the oldest goes first.
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(LIFETIME_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.id, onDismiss]);

  const bar = toast.tone === "error" ? "bg-danger" : toast.tone === "info" ? "bg-accent" : "bg-success";
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-md border border-line bg-surface py-3 pl-3 pr-2 text-sm text-ink shadow-raised"
    >
      <span className={`mt-0.5 h-4 w-1 shrink-0 rounded-full ${bar}`} aria-hidden="true" />
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-graphite hover:bg-page-bg hover:text-ink"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Outside the provider (e.g. the login page) toasts are a no-op rather than a crash.
  return ctx ?? { toast: () => {} };
}

"use client";

import { useEffect } from "react";

export type StatusToastTone = "success" | "info" | "warning" | "error";

const TONE_STYLES: Record<StatusToastTone, {
  border: string;
  icon: string;
  progress: string;
}> = {
  success: {
    border: "border-emerald-400/35",
    icon: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    progress: "bg-emerald-400",
  },
  info: {
    border: "border-sky-400/35",
    icon: "border-sky-400/30 bg-sky-500/15 text-sky-300",
    progress: "bg-sky-400",
  },
  warning: {
    border: "border-amber-400/35",
    icon: "border-amber-400/30 bg-amber-500/15 text-amber-300",
    progress: "bg-amber-400",
  },
  error: {
    border: "border-red-400/35",
    icon: "border-red-400/30 bg-red-500/15 text-red-300",
    progress: "bg-red-400",
  },
};

export default function StatusToast({
  open,
  title,
  description,
  tone = "success",
  duration = 5200,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  tone?: StatusToastTone;
  duration?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;
  const styles = TONE_STYLES[tone];

  return (
    <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[150] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 sm:left-auto sm:right-5 sm:top-5 sm:translate-x-0">
      <section
        role={tone === "error" ? "alert" : "status"}
        aria-live={tone === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        className={`status-toast pointer-events-auto relative overflow-hidden rounded-2xl border bg-[var(--card)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] ${styles.border}`}
      >
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-[#2563eb]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#dc2626]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#2563eb]" />
        </div>
        <div className="flex items-start gap-3 p-3.5 pr-12 sm:p-4 sm:pr-12">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${styles.icon}`} aria-hidden="true">
            <ToastIcon tone={tone} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-sm font-extrabold leading-5 text-[var(--text)]">{title}</h2>
            <p className="mt-0.5 text-[12.5px] leading-[18px] text-[var(--muted)]">{description}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar notificación"
          onClick={onClose}
          className="absolute right-2.5 top-3.5 grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--bg-soft)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <span
          className={`status-toast-progress absolute inset-x-0 bottom-0 h-0.5 ${styles.progress}`}
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden="true"
        />
      </section>
    </div>
  );
}

function ToastIcon({ tone }: { tone: StatusToastTone }) {
  if (tone === "success") {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 17h.01" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

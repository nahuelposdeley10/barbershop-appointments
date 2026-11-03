"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_CLOSE_SECONDS = 6;

type BookingSuccessModalProps = {
  service: string;
  dateLabel: string;
  time: string;
  onClose: () => void;
};

export default function BookingSuccessModal({
  service,
  dateLabel,
  time,
  onClose,
}: BookingSuccessModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const countdownId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);
    const closeId = window.setTimeout(onClose, AUTO_CLOSE_SECONDS * 1_000);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      window.clearInterval(countdownId);
      window.clearTimeout(closeId);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        aria-describedby="booking-success-description"
        className="w-full max-w-sm overflow-hidden rounded-[28px] border border-emerald-400/35 bg-[var(--card)] shadow-[0_28px_90px_rgba(0,0,0,0.5)]"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-300 to-accent" aria-hidden="true" />
        <div className="px-5 pb-5 pt-6 text-center sm:px-7 sm:pb-7">
          <span
            className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_8px_rgba(16,185,129,0.06)]"
            aria-hidden="true"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>

          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[2.4px] text-emerald-300">
            Reserva confirmada
          </p>
          <h2 id="booking-success-title" className="mt-2 text-[25px] font-extrabold leading-tight tracking-[-0.5px] text-[var(--text)]">
            Reservaste para las {time} h
          </h2>
          <p id="booking-success-description" className="mt-2 text-sm leading-5 text-[var(--muted)]">
            Tu turno quedó guardado correctamente.
          </p>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent" aria-hidden="true">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4M16 2v4M3 10h18" />
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="m9 16 2 2 4-4" />
                </svg>
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[15px] font-extrabold text-[var(--text)]">{service}</strong>
                <span className="mt-0.5 block text-[13px] text-[var(--muted)]">{dateLabel} · {time} h</span>
              </span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="mt-5 min-h-11 w-full rounded-xl bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] px-5 py-3 text-sm font-extrabold text-[#1a1406] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Entendido
          </button>

          <div className="mt-4" aria-hidden="true">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Se cierra automáticamente en {secondsLeft} s
            </div>
            <div className="mx-auto mt-2 h-1 w-36 overflow-hidden rounded-full bg-[var(--border)]">
              <span
                className="block h-full rounded-full bg-emerald-400 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{ width: `${(secondsLeft / AUTO_CLOSE_SECONDS) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel = "Volver",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-red-400/25 bg-[var(--card)] shadow-2xl shadow-black/40"
      >
        <div className="h-1 bg-gradient-to-r from-red-400 via-amber-300 to-transparent" aria-hidden="true" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-400/12 text-red-300" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 2.8 20h18.4L12 3Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="text-lg font-extrabold text-[var(--text)]">{title}</h2>
              <p id="confirm-dialog-description" className="mt-1.5 text-sm leading-5 text-[var(--muted)]">{description}</p>
            </div>
          </div>
          {detail && (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-sm font-semibold text-[var(--text)]">
              {detail}
            </div>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="min-h-11 rounded-xl bg-gradient-to-b from-red-400 to-red-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:min-w-36"
            >
              {loading ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

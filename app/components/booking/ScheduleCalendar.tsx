"use client";

import { useEffect, useState } from "react";
import { getMonthAvailability } from "@/lib/client-api";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

type Props = {
  value: string;
  minDate: string;
  maxDate: string;
  service: string;
  tenantSlug?: string;
  onSelect: (d: string) => void;
};

export default function ScheduleCalendar({
  value,
  minDate,
  maxDate,
  service,
  tenantSlug,
  onSelect,
}: Props) {
  const start = new Date(`${value || minDate}T00:00:00`);
  const [display, setDisplay] = useState({
    y: start.getFullYear(),
    m: start.getMonth(),
  });
  const [statusByDate, setStatusByDate] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gridStart = new Date(display.y, display.m, 1);
    gridStart.setDate(1 - gridStart.getDay());
    const from = dateStr(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setStatusByDate({});
    });
    getMonthAvailability(from, service, tenantSlug)
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const d of data.days || []) map[d.date] = d.status;
        setStatusByDate(map);
      })
      .catch(() => {
        if (!cancelled) setStatusByDate({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [display.y, display.m, service, tenantSlug]);

  const minParts = minDate.split("-").map(Number);
  const maxParts = maxDate.split("-").map(Number);
  const atMinMonth = display.y === minParts[0] && display.m === minParts[1] - 1;
  const atMaxMonth = display.y === maxParts[0] && display.m === maxParts[1] - 1;

  function move(offset: number) {
    const d = new Date(display.y, display.m + offset, 1);
    setDisplay({ y: d.getFullYear(), m: d.getMonth() });
  }

  const gridStart = new Date(display.y, display.m, 1);
  const offset = gridStart.getDay();
  const cells: { ds: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(display.y, display.m, 1 - offset + i);
    cells.push({
      ds: dateStr(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === display.m,
    });
  }

  return (
    <div className="flex flex-col gap-2.5" aria-busy={loading}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--text)] text-lg leading-none disabled:opacity-35 disabled:cursor-default"
          onClick={() => move(-1)}
          disabled={atMinMonth}
          aria-label="Mes anterior"
        >
          ‹
        </button>
        <strong className="text-base">
          {MONTH_NAMES[display.m]} {display.y}
        </strong>
        <button
          type="button"
          className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--text)] text-lg leading-none disabled:opacity-35 disabled:cursor-default"
          onClick={() => move(1)}
          disabled={atMaxMonth}
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11.5px] font-extrabold text-[var(--muted)] uppercase tracking-wide py-1">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[5px]">
        {cells.map(({ ds, day, inMonth }) => {
          const status = statusByDate[ds];
          const isPast = ds < minDate;
          const isBeyond = ds > maxDate;
          const clickable = !isPast && !isBeyond && status === "free";
          const statusLabel =
            status === "free"
              ? "con horarios disponibles"
              : status === "full"
                ? "completo"
                : status === "closed"
                  ? "sin atención"
                  : "disponibilidad no cargada";
          const cls = [
            "relative aspect-square grid place-items-center rounded-[11px] border text-[14.5px] font-bold p-0",
            inMonth ? "" : "opacity-25",
            isPast || isBeyond
              ? "bg-[var(--bg-soft)] text-[var(--muted)] opacity-30"
              : status === "free"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/45 hover:bg-emerald-500/30"
                : status === "full"
                  ? "bg-red-500/12 text-red-300 border-red-500/40 line-through"
                  : status === "closed"
                    ? "bg-[var(--bg-soft)] text-[var(--muted)]"
                    : "bg-[var(--bg-soft)] text-[var(--muted)]",
            ds === value ? "outline-2 outline-offset-1 outline-[var(--accent)] text-[var(--accent)]" : "",
            clickable ? "cursor-pointer" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={ds}
              type="button"
              className={cls}
              disabled={!clickable}
              aria-label={`${day} de ${MONTH_NAMES[display.m]} de ${display.y}, ${statusLabel}`}
              aria-pressed={ds === value}
              onClick={() => onSelect(ds)}
            >
              {day}
              {ds === minDate && (
                <i className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-[var(--muted)] text-sm" role="status" aria-live="polite">
          Actualizando disponibilidad…
        </p>
      )}

      <div className="flex flex-wrap gap-3.5 pt-0.5">
        <Legend color="bg-emerald-400" label="Disponible" />
        <Legend color="bg-red-400" label="Día lleno" />
        <Legend color="bg-zinc-500" label="No atendemos" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
      <i className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

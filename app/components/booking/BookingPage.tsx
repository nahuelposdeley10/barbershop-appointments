"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  createBooking,
  getAvailability,
  BookingConfirmation,
  Service,
  Slot,
} from "@/lib/client-api";
import { BarberPole, ServiceIcon } from "./BarberIcons";
import ScheduleCalendar from "./ScheduleCalendar";
import Navbar from "../Navbar";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const HERO_IMG =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1400&auto=format&fit=crop";

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function currency(n: number) {
  return `$${Number(n || 0).toLocaleString("es-AR")}`;
}

export default function BookingPage() {
  const today = localDateStr(new Date());
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return localDateStr(d);
  })();

  const [barberName, setBarberName] = useState("Barbería");
  const [message, setMessage] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<BookingConfirmation | null>(null);

  const freeCount = slots.filter((s) => s.free).length;

  useEffect(() => {
    document.title = `${barberName} · Reservá tu turno online`;
  }, [barberName]);

  useEffect(() => {
    let cancelled = false;
    getAvailability(date, selectedService)
      .then((data) => {
        if (cancelled) return;
        setBarberName(data.barberName);
        setMessage(data.message || "");
        setServices(data.services || []);
        setSlots(data.slots || []);
        setError("");
        if (!selectedService && data.services && data.services.length) {
          setSelectedService(data.services[0].name);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, selectedService]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || phone.trim().length < 6) {
      setError("Ingresá tu nombre y un teléfono válido");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const booking = await createBooking({
        name: name.trim(),
        phone: phone.trim(),
        service: selectedService,
        date,
        time: selectedSlot,
      });
      setConfirm(booking);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      if (/ocupado/.test(message)) setSelectedSlot("");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setConfirm(null);
    setSelectedSlot("");
    setName("");
    setPhone("");
    setError("");
  }

  if (confirm) {
    return (
      <div className="booking-bg">
        <div className="max-w-[720px] mx-auto px-4 py-10">
          <div className="flex flex-col items-center text-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 mt-[10vh]">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 text-[28px] grid place-items-center">
              ✓
            </div>
            <h1 className="text-3xl font-bold">¡Turno reservado!</h1>
            <p className="text-[var(--muted)]">{barberName}</p>
            <ul className="w-full flex flex-col list-none m-0 p-0">
              <ConfirmRow label="Servicio" value={confirm.service} />
              <ConfirmRow label="Fecha" value={formatDate(confirm.date)} />
              <ConfirmRow label="Hora" value={confirm.time} />
              <ConfirmRow label="Nombre" value={confirm.name} />
              <ConfirmRow label="Teléfono" value={confirm.phone} />
              <ConfirmRow label="Dirección" value="Te esperamos en el local" />
            </ul>
            <button
              type="button"
              onClick={resetForm}
              className="mt-4 px-6 py-3 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406]"
            >
              Reservar otro turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-bg">
      <Navbar nombre={barberName} />
      <div className="flex flex-col gap-5 max-w-[720px] w-full mx-auto pt-24 px-5 pb-16">

        {/* Hero */}
        <section className="relative h-[270px] rounded-[20px] overflow-hidden border border-[var(--border)]">
          <Image
            src={HERO_IMG}
            alt=""
            fill
            sizes="(max-width: 720px) 100vw, 720px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/55 via-transparent to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/75 to-transparent" />
          <div className="relative h-full flex flex-col justify-center items-center gap-3 p-6 text-center">
            <span className="text-[11px] font-extrabold tracking-[4px] uppercase text-accent bg-zinc-950/55 border border-accent/40 px-2.5 py-1 rounded-full">
              Barbershop
            </span>
            <BarberPole className="w-56 h-[9px] shadow-[0_4px_20px_rgba(0,0,0,0.45)]" />
            <h1 className="text-[34px] leading-tight font-bold tracking-[-0.5px] text-white drop-shadow-lg">
              Reservá tu turno
            </h1>
            <p className="text-[#e7e2d8] drop-shadow text-sm">{message}</p>
          </div>
        </section>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-2">
          {["Sin esperas", "Confirmación al instante", "Agenda 100% online"].map(
            (f) => (
              <span key={f} className="text-[13px] font-bold text-[var(--text)] bg-[var(--card)] border border-[var(--border)] rounded-full px-3.5 py-1.5">
                ✓ {f}
              </span>
            )
          )}
        </div>

        {/* Paso 1: Servicio */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5">
          <h2 className="text-[17px] font-bold">
            <Step n={1} /> Elegí el servicio
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
            {services.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setSelectedService(s.name);
                  setSelectedSlot("");
                }}
                className={`text-left bg-[var(--card-2)] border rounded-[14px] p-3.5 flex flex-col gap-1 text-[var(--text)] transition-colors ${
                  selectedService === s.name
                    ? "border-[var(--accent)] bg-accent/15"
                    : "border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                <ServiceIcon service={s.name} />
                <strong>{s.name}</strong>
                <span className={`text-[13.5px] ${selectedService === s.name ? "text-accent" : "text-[var(--muted)]"}`}>
                  {currency(s.price)} · {s.duration} min
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Paso 2: Día */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5">
          <h2 className="text-[17px] font-bold">
            <Step n={2} /> Elegí el día
          </h2>
          <div className="mt-1">
            <ScheduleCalendar
              value={date}
              minDate={today}
              maxDate={maxDate}
              service={selectedService}
              onSelect={(d) => {
                setDate(d);
                setSelectedSlot("");
              }}
            />
          </div>
        </section>

        {/* Paso 3: Hora */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5">
          <h2 className="text-[17px] font-bold">
            <Step n={3} /> Elegí la hora
          </h2>
          {error && !selectedSlot ? (
            <p className="text-[var(--red)] font-semibold">{error}</p>
          ) : (
            <p className="text-[var(--muted)]">
              {formatDate(date)} · {selectedService || "servicio"}
            </p>
          )}
          {loading ? (
            <p className="text-[var(--muted)]">Cargando horarios…</p>
          ) : slots.length === 0 ? (
            <p className="text-[var(--muted)] bg-[var(--bg-soft)] border border-dashed border-[var(--border)] rounded-xl p-5 text-center">
              No hay horarios disponibles para este día. Probá con otra fecha.
            </p>
          ) : (
            <>
              {freeCount === 0 && (
                <p className="text-[var(--muted)] bg-[var(--bg-soft)] border border-dashed border-[var(--border)] rounded-xl p-5 text-center">
                  Este día está lleno, todos los horarios están ocupados.
                </p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
                {slots.map((slot) => {
                  let cls =
                    "py-2.5 rounded-xl border font-bold text-sm ";
                  if (slot.free) {
                    cls += selectedSlot === slot.time
                      ? "bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] border-transparent"
                      : "bg-emerald-500/14 text-emerald-400 border-emerald-500/45 hover:bg-emerald-500/28";
                  } else {
                    cls += "bg-red-500/12 text-red-300 border-red-500/38 line-through cursor-default";
                  }
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={cls}
                      disabled={!slot.free}
                      onClick={() => {
                        setSelectedSlot(slot.time);
                        setError("");
                        setPhone("");
                        setName("");
                      }}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3.5">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                  <i className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Libre
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                  <i className="w-2.5 h-2.5 rounded-full bg-red-400" /> Ocupado
                </span>
              </div>
            </>
          )}
        </section>

        {/* Paso 4: Datos */}
        {selectedSlot && (
          <section className="bg-[var(--card)] border border-[var(--accent)] rounded-2xl p-[22px] flex flex-col gap-3.5">
            <h2 className="text-[17px] font-bold">
              <Step n={4} /> Tus datos
            </h2>
            <p className="text-[var(--muted)]">
              {selectedService} · {formatDate(date)} a las{" "}
              <strong className="text-[var(--text)]">{selectedSlot} h</strong>
            </p>
            {error && <p className="text-[var(--red)] font-semibold">{error}</p>}
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <Field label="Nombre">
                <input
                  className="w-full px-3.5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </Field>
              <Field label="Teléfono / WhatsApp">
                <input
                  className="w-full px-3.5 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 1155667788"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <div className="flex justify-between gap-2.5">
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-[var(--text)] hover:border-[var(--accent)]"
                  onClick={() => setSelectedSlot("")}
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
                >
                  {submitting ? "Reservando…" : "Confirmar turno"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="inline-grid place-items-center w-[22px] h-[22px] rounded-full bg-accent/15 text-accent text-[13px] mr-2 align-[1px]">
      {n}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 font-semibold text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3 py-2.5 border-b border-[var(--border)] text-[15px]">
      <span className="text-[var(--muted)]">{label}</span>
      <strong className="text-right">{value}</strong>
    </li>
  );
}

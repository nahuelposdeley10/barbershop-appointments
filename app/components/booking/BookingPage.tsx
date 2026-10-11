"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  createBooking,
  cancelBooking,
  getManagedBooking,
  getAvailability,
  BookingConfirmation,
  updateBookingSchedule,
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
const BOOKING_STORAGE_KEY = "barberia:booking-token";

function localDateStr(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTH_NAMES[d.getUTCMonth()]}`;
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
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<BookingConfirmation | null>(null);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const freeCount = slots.filter((s) => s.free).length;

  useEffect(() => {
    document.title = `${barberName} · Reservá tu turno online`;
  }, [barberName]);

  useEffect(() => {
    let active = true;
    async function restoreBooking() {
      const raw = window.localStorage.getItem(BOOKING_STORAGE_KEY);
      if (!raw) return;
      try {
        const stored = JSON.parse(raw) as { manageToken?: string };
        if (!stored.manageToken) throw new Error("Token inválido");
        const booking = await getManagedBooking(stored.manageToken);
        if (!active) return;
        setConfirm({ ...booking, manageToken: stored.manageToken });
        setCancelled(booking.status === "cancelled");
      } catch {
        window.localStorage.removeItem(BOOKING_STORAGE_KEY);
      }
    }
    void restoreBooking();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestedDate = date || localDateStr(new Date());
    getAvailability(requestedDate, selectedService)
      .then((data) => {
        if (cancelled) return;
        setBarberName(data.barberName);
        setMessage(data.message || "");
        setServices(data.services || []);
        setSlots(data.slots || []);
        setError("");
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

  async function refreshSlots() {
    try {
      const data = await getAvailability(date || today, selectedService);
      setBarberName(data.barberName);
      setMessage(data.message || "");
      setServices(data.services || []);
      setSlots(data.slots || []);
      setError("");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !selectedSlot) {
      setError("Elegí una fecha y un horario antes de continuar");
      return;
    }
    if (editing) {
      if (!confirm?.manageToken) {
        setError("No encontramos el acceso privado de este turno");
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        const updated = await updateBookingSchedule(confirm.manageToken, {
          service: selectedService,
          date,
          time: selectedSlot,
        });
        setConfirm({
          ...updated,
          manageToken: confirm.manageToken,
          address: confirm.address,
        });
        setEditing(false);
        setCancelled(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No pudimos actualizar el turno";
        setError(message);
        if (/disponible|ocupado/.test(message)) {
          setSelectedSlot("");
          setStep(3);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError("Ingresá tu nombre y un teléfono válido");
      return;
    }
    if (!acceptedTerms) {
      setError("Aceptá los términos de reserva para continuar");
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
      if (booking.manageToken) {
        window.localStorage.setItem(
          BOOKING_STORAGE_KEY,
          JSON.stringify({ manageToken: booking.manageToken })
        );
      }
      await refreshSlots();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      if (/ocupado/.test(message)) {
        setSelectedSlot("");
        setStep(3);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    window.localStorage.removeItem(BOOKING_STORAGE_KEY);
    setConfirm(null);
    setDate("");
    setSelectedSlot("");
    setStep(1);
    setName("");
    setPhone("");
    setAcceptedTerms(false);
    setError("");
    setCancelled(false);
    setCancelling(false);
    setEditing(false);
  }

  function startEditingBooking() {
    if (!confirm?.manageToken || cancelled) return;
    setEditing(true);
    setSelectedService(confirm.service);
    setDate("");
    setSelectedSlot("");
    setStep(2);
    setError("");
  }

  async function handleCancelBooking() {
    if (!confirm?.manageToken || cancelling) return;
    if (!window.confirm("¿Querés cancelar este turno? Esta acción libera el horario.")) return;
    setCancelling(true);
    setError("");
    try {
      await cancelBooking(confirm.manageToken);
      setCancelled(true);
      setConfirm({ ...confirm, status: "cancelled" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cancelar el turno");
    } finally {
      setCancelling(false);
    }
  }

  if (confirm && !editing) {
    return (
      <div className="booking-bg">
        <div className="max-w-[720px] mx-auto px-4 py-10">
          <div className="flex flex-col items-center text-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 mt-[10vh]">
            <div className={`w-14 h-14 rounded-full text-[28px] grid place-items-center ${cancelled ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {cancelled ? "×" : "✓"}
            </div>
            <h1 className="text-3xl font-bold">{cancelled ? "Turno cancelado" : "¡Solicitud recibida!"}</h1>
            <p className="text-[var(--muted)]">{barberName}</p>
            {!cancelled && (
              <p className="text-sm text-[var(--muted)] bg-[var(--bg-soft)] border border-[var(--border)] rounded-xl px-4 py-3">
                Tu solicitud quedó registrada. El local puede confirmarte el turno si necesita validar disponibilidad.
              </p>
            )}
            <ul className="w-full flex flex-col list-none m-0 p-0">
              <ConfirmRow label="Servicio" value={confirm.service} />
              <ConfirmRow label="Fecha" value={formatDate(confirm.date)} />
              <ConfirmRow label="Hora" value={confirm.time} />
              <ConfirmRow label="Nombre" value={confirm.name} />
              <ConfirmRow label="Teléfono" value={confirm.phone} />
              <ConfirmRow label="Dirección" value={confirm.address || "Te esperamos en el local"} />
            </ul>
            {!cancelled && (
              <div className="w-full flex flex-col gap-2.5">
                <p className="text-sm text-[var(--muted)]">
                  Guardá esta pantalla. Podés editar el horario o cancelar el turno desde acá.
                </p>
                {confirm.manageToken && (
                  <>
                    <button
                      type="button"
                      onClick={startEditingBooking}
                      className="w-full px-5 py-3 rounded-xl font-bold text-center bg-[var(--card-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)]"
                    >
                      Editar horario
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelBooking}
                      disabled={cancelling}
                      className="w-full px-5 py-3 rounded-xl font-bold text-center text-red-300 border border-red-500/30 disabled:opacity-60"
                    >
                      {cancelling ? "Cancelando…" : "Cancelar turno"}
                    </button>
                  </>
                )}
              </div>
            )}
            {error && <p role="alert" className="w-full text-sm text-[var(--red)] font-semibold">{error}</p>}
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
      <div className="flex flex-col gap-4 sm:gap-5 max-w-[720px] w-full mx-auto pt-20 sm:pt-24 px-3.5 sm:px-5 pb-12 sm:pb-16">

        {/* Hero */}
        <section className="relative h-[215px] sm:h-[270px] rounded-[18px] sm:rounded-[20px] overflow-hidden border border-[var(--border)]">
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
          <div className="relative h-full flex flex-col justify-center items-center gap-2.5 sm:gap-3 p-5 sm:p-6 text-center">
            <span className="text-[10px] sm:text-[11px] font-extrabold tracking-[3px] sm:tracking-[4px] uppercase text-accent bg-zinc-950/55 border border-accent/40 px-2.5 py-1 rounded-full">
              Barbershop
            </span>
            <BarberPole className="w-40 sm:w-56 h-[8px] sm:h-[9px] shadow-[0_4px_20px_rgba(0,0,0,0.45)]" />
            <h1 className="text-[29px] sm:text-[34px] leading-tight font-bold tracking-[-0.5px] text-white drop-shadow-lg">
              Reservá tu turno
            </h1>
            <p className="text-[#e7e2d8] drop-shadow text-[13px] sm:text-sm">{message}</p>
          </div>
        </section>

        {/* Features */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {["Sin esperas", "Confirmación rápida", "Agenda online"].map(
            (f) => (
              <span key={f} className="min-h-10 flex items-center justify-center text-center leading-tight text-[10.5px] sm:text-[13px] font-bold text-[var(--text)] bg-[var(--card)] border border-[var(--border)] rounded-xl sm:rounded-full px-1.5 sm:px-3.5 py-1.5">
                ✓ {f}
              </span>
            )
          )}
        </div>

        <BookingProgress step={step} />

        {/* Step 1: Service */}
        {step === 1 && <section className="bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <div className="flex items-start gap-3">
            <Step n={1} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold tracking-[2px] uppercase text-accent mb-1">Paso 1 de 4</p>
              <h2 className="text-[23px] sm:text-[26px] leading-tight font-bold tracking-[-0.3px]">
                Elegí tu próximo look
              </h2>
              <p className="text-[var(--muted)] text-sm mt-1">
                Seleccioná un servicio para ver los horarios disponibles.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {services.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setSelectedService(s.name);
                  setDate("");
                  setSelectedSlot("");
                  setStep(2);
                  setLoading(true);
                }}
                className={`group w-full min-h-[92px] text-left bg-[var(--card-2)] border rounded-[17px] p-3.5 flex items-center gap-3 text-[var(--text)] transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                  selectedService === s.name
                    ? "border-[var(--accent)] bg-accent/15 shadow-[0_8px_24px_rgba(212,168,83,0.12)]"
                    : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--card)]"
                }`}
              >
                <ServiceIcon service={s.name} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[15px] sm:text-base">{s.name}</strong>
                  <span className="block mt-1 text-[12.5px] text-[var(--muted)]">
                    {s.duration} min · {currency(s.price)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-xl text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-accent">›</span>
              </button>
            ))}
          </div>
          {loading && services.length === 0 && (
            <p className="text-[var(--muted)] bg-[var(--bg-soft)] rounded-xl p-4 text-center">
              Cargando servicios…
            </p>
          )}
          {error && services.length === 0 && (
            <p role="alert" className="text-[var(--red)] font-semibold">
              {error}
            </p>
          )}
        </section>}

        {/* Step 2: Day */}
        {step === 2 && <section className="bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="text-[17px] font-bold">
            <Step n={2} /> {editing ? "¿Qué nuevo día te queda cómodo?" : "¿Qué día te queda cómodo?"}
          </h2>
          <p className="text-[var(--muted)] text-sm">
            {selectedService} · Primero elegí la fecha y después te mostramos los horarios.
          </p>
          {error && <p role="alert" className="text-[var(--red)] font-semibold">{error}</p>}
          <div className="mt-1">
            <ScheduleCalendar
              value={date}
              minDate={today}
              maxDate={maxDate}
              service={selectedService}
              onSelect={(d) => {
                setDate(d);
                setSelectedSlot("");
                setStep(3);
                setError("");
                setLoading(true);
              }}
            />
          </div>
          <WizardBackButton
            label={editing ? "Volver al turno" : "Cambiar servicio"}
            onClick={() => {
              if (editing) {
                setEditing(false);
                setDate("");
                setSelectedSlot("");
                setStep(1);
                return;
              }
              setDate("");
              setSelectedSlot("");
              setStep(1);
            }}
          />
        </section>}

        {/* Step 3: Time */}
        {step === 3 && date && <section className="bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 className="text-[17px] font-bold">
            <Step n={3} /> Elegí un horario
          </h2>
          <SelectionSummary service={selectedService} date={formatDate(date)} />
          {error && <p role="alert" className="text-[var(--red)] font-semibold">{error}</p>}
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
                  const lleno = !slot.free;
                  const parcial = slot.free && slot.ocupadas > 0;
                  if (selectedSlot === slot.time && slot.free) {
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        className="py-2.5 rounded-xl border font-bold text-sm bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] border-transparent"
                        onClick={() => {
                          setSelectedSlot(slot.time);
                          setStep(4);
                          setError("");
                        }}
                      >
                        {slot.time}
                      </button>
                    );
                  }
                  if (lleno) {
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled
                        className="py-2.5 rounded-xl border font-bold text-sm bg-red-500/12 text-red-300 border-red-500/38 line-through cursor-default"
                      >
                        {slot.time}
                      </button>
                    );
                  }
                  if (parcial) {
                    const librePct = Math.round(
                      ((slot.sillas - slot.ocupadas) / slot.sillas) * 100
                    );
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        className="relative overflow-hidden rounded-xl border font-bold text-sm text-[#1a1406] border-emerald-500/50"
                        onClick={() => {
                          setSelectedSlot(slot.time);
                          setStep(4);
                          setError("");
                        }}
                      >
                        <span
                          className="absolute inset-y-0 right-0 bg-emerald-500/30"
                          style={{ width: `${librePct}%` }}
                        />
                        <span
                          className="absolute inset-y-0 left-0 bg-red-500/30"
                          style={{ width: `${100 - librePct}%` }}
                        />
                        <span className="relative z-10 block py-2.5 text-center">
                          {slot.time}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className="py-2.5 rounded-xl border font-bold text-sm bg-emerald-500/14 text-emerald-400 border-emerald-500/45 hover:bg-emerald-500/28"
                      onClick={() => {
                        setSelectedSlot(slot.time);
                        setStep(4);
                        setError("");
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
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                  <i className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-red-400 to-emerald-400" /> Medio ocupado
                </span>
              </div>
            </>
          )}
          <WizardBackButton
            label="Cambiar fecha"
            onClick={() => {
              setStep(2);
              setSelectedSlot("");
            }}
          />
        </section>}

        {/* Step 4: Info */}
        {step === 4 && selectedSlot && (
          <section className="bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <h2 className="text-[17px] font-bold">
              <Step n={4} /> {editing ? "Confirmá el nuevo horario" : "Confirmá tus datos"}
            </h2>
            <SelectionSummary service={selectedService} date={`${formatDate(date)} · ${selectedSlot} h`} />
            {error && <p role="alert" className="text-[var(--red)] font-semibold">{error}</p>}
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              {!editing && (
                <>
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
                  <label className="flex items-start gap-2.5 text-sm text-[var(--muted)] leading-5">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span>
                      Acepto los <a href="/terminos" target="_blank" rel="noreferrer" className="text-accent underline">términos de reserva</a> y la <a href="/privacidad" target="_blank" rel="noreferrer" className="text-accent underline">política de privacidad</a>.
                    </span>
                  </label>
                </>
              )}
              <div className="grid grid-cols-1 sm:flex sm:justify-between gap-2.5">
                <button
                  type="button"
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-[var(--text)] hover:border-[var(--accent)]"
                  onClick={() => {
                    setStep(3);
                  }}
                >
                  Cambiar horario
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
                >
                  {submitting ? (editing ? "Guardando…" : "Reservando…") : editing ? "Guardar nuevo horario" : "Confirmar turno"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function BookingProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = [
    { n: 1, label: "Servicio" },
    { n: 2, label: "Fecha" },
    { n: 3, label: "Horario" },
    { n: 4, label: "Datos" },
  ] as const;

  return (
    <nav aria-label="Progreso de la reserva" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 px-2.5 py-3 sm:px-5">
      <div className="relative grid grid-cols-4 gap-1">
        <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-3 h-px bg-[var(--border)]" />
        {items.map((item) => (
          <div key={item.n} className="relative z-10 flex min-w-0 flex-col items-center gap-1.5 text-center">
          <span
            aria-current={item.n === step ? "step" : undefined}
            className={`inline-grid place-items-center w-6 h-6 rounded-full border text-[11px] font-extrabold bg-[var(--card)] ${
              item.n === step
                ? "border-[var(--accent)] text-[var(--accent)] shadow-[0_0_0_4px_rgba(212,168,83,0.10)]"
                : item.n < step
                  ? "border-emerald-400 text-emerald-400"
                  : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {item.n < step ? "✓" : item.n}
          </span>
          <span className={`text-[10px] sm:text-[12px] font-bold truncate max-w-full ${item.n === step ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
            {item.label}
          </span>
        </div>
        ))}
      </div>
    </nav>
  );
}

function SelectionSummary({ service, date }: { service: string; date: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] border border-[var(--border)] px-3 py-1.5">
        <strong className="text-[var(--text)]">{service}</strong>
      </span>
      <span className="text-[var(--muted)]">·</span>
      <span>{date}</span>
    </div>
  );
}

function WizardBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="self-start text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      onClick={onClick}
    >
      ← {label}
    </button>
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

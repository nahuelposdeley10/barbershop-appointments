"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import {
  createBooking,
  cancelBooking,
  getManagedBooking,
  getAvailability,
  BookingConfirmation,
  Service,
  Slot,
} from "@/lib/client-api";
import { BarberPole, ServiceThumb } from "./BarberIcons";
import ScheduleCalendar from "./ScheduleCalendar";
import Navbar from "../Navbar";
import ConfirmDialog from "../ConfirmDialog";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const HERO_IMG =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1400&auto=format&fit=crop";
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const BOOKINGS_STORAGE_KEY = "barberia:bookings";
const LEGACY_BOOKING_STORAGE_KEY = "barberia:booking-token";
const TERMS_STORAGE_KEY = "barberia:terms-accepted";

/** ¿La persona ya aceptó los términos en este dispositivo? */
function loadTermsAccepted() {
  try {
    return window.localStorage.getItem(TERMS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistTermsAccepted() {
  try {
    window.localStorage.setItem(TERMS_STORAGE_KEY, "1");
  } catch {
    // Si el navegador bloquea el storage, el aviso vuelve a mostrarse la próxima vez.
  }
}

function localDateStr(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
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

/** Fecha y hora local de la barbería en formato "YYYY-MM-DD HH:MM" (para comparar). */
function localDateTimeStr(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

/** Fin del turno (fecha + hora + duración) en el mismo formato local. */
function bookingEndStr(booking: { date?: string; time?: string; duration?: number }) {
  const [y, m, d] = (booking.date || "").split("-").map(Number);
  const [hh, mm] = (booking.time || "").split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return "";
  const end = new Date(Date.UTC(y, m - 1, d, hh, mm + Math.max(0, Number(booking.duration) || 0)));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())} ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

function isBookingFinished(booking: { date?: string; time?: string; duration?: number }) {
  const end = bookingEndStr(booking);
  return end ? localDateTimeStr(new Date()) >= end : false;
}

function isBookingActive(booking: BookingConfirmation) {
  if (booking.status === "cancelled" || booking.status === "done") return false;
  if (!booking.manageToken || !booking.date || !booking.time) return false;
  return !isBookingFinished(booking);
}

function persistBookings(bookings: BookingConfirmation[]) {
  try {
    window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify({ bookings }));
    // La migración terminó cuando el formato nuevo quedó escrito.
    window.localStorage.removeItem(LEGACY_BOOKING_STORAGE_KEY);
  } catch {
    // Si el navegador bloquea el storage, los turnos siguen disponibles en el servidor.
  }
}

/** Lee los turnos guardados en el dispositivo (sin modificar el storage). */
function loadStoredBookings(): BookingConfirmation[] {
  const raw = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { bookings?: unknown };
      if (Array.isArray(parsed.bookings)) {
        return parsed.bookings.filter(
          (item): item is BookingConfirmation =>
            Boolean(item) && typeof item === "object" && Boolean((item as BookingConfirmation).manageToken)
        );
      }
    } catch {
      window.localStorage.removeItem(BOOKINGS_STORAGE_KEY);
    }
  }
  // Compatibilidad con el formato anterior (un solo turno por dispositivo).
  const legacy = window.localStorage.getItem(LEGACY_BOOKING_STORAGE_KEY);
  if (!legacy) return [];
  try {
    const parsed = JSON.parse(legacy) as { manageToken?: string; booking?: BookingConfirmation };
    if (!parsed.manageToken || !parsed.booking) return [];
    return [{ ...parsed.booking, manageToken: parsed.manageToken }];
  } catch {
    return [];
  }
}

function inactiveNotice(booking: { status?: string }) {
  if (booking.status === "cancelled") {
    return "Tu turno fue cancelado y el horario ya quedó liberado.";
  }
  if (booking.status === "done") {
    return "Tu turno ya fue completado. Cuando quieras, podés reservar uno nuevo.";
  }
  return "Tu turno ya finalizó. Cuando quieras, podés reservar uno nuevo.";
}

type VerifyDeps = {
  setBookings: Dispatch<SetStateAction<BookingConfirmation[]>>;
  setVerifying: Dispatch<SetStateAction<boolean>>;
  setBookingNotice: Dispatch<SetStateAction<string>>;
};

type VerifyResult =
  | { token: string; kind: "active"; booking: BookingConfirmation }
  | { token: string; kind: "inactive"; booking: BookingConfirmation }
  | { token: string; kind: "gone" }
  | { token: string; kind: "error" };

/**
 * Consulta al servidor el estado real de cada turno guardado: actualiza los
 * activos, quita de la lista los cancelados/completados/vencidos y conserva
 * los que no se pudieron consultar por problemas de conexión.
 */
async function verifyBookings(
  tokens: string[],
  deps: VerifyDeps,
  isAlive: () => boolean = () => true
) {
  if (tokens.length === 0) return;
  deps.setVerifying(true);
  try {
    const results: VerifyResult[] = await Promise.all(
      tokens.map(async (token): Promise<VerifyResult> => {
        let booking: BookingConfirmation;
        try {
          booking = await getManagedBooking(token);
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          if (/Turno no encontrado|Link inválido/.test(message)) return { token, kind: "gone" };
          return { token, kind: "error" };
        }
        const merged = { ...booking, manageToken: token };
        if (!isBookingActive(merged)) return { token, kind: "inactive", booking: merged };
        return { token, kind: "active", booking: merged };
      })
    );
    if (!isAlive()) return;

    const messages: string[] = [];
    for (const result of results) {
      if (result.kind === "inactive") messages.push(inactiveNotice(result.booking));
      else if (result.kind === "gone") {
        messages.push("Uno de tus turnos ya no está disponible y se quitó de la lista.");
      }
    }
    const notice =
      messages.length === 1
        ? messages[0]
        : messages.length > 1
          ? "Algunos de tus turnos ya no están activos y se quitaron de la lista."
          : "";

    const byToken = new Map(results.map((result) => [result.token, result]));
    deps.setBookings((prev) =>
      prev.flatMap((entry) => {
        const token = entry.manageToken || "";
        const result = byToken.get(token);
        if (!result || result.kind === "error") return [entry];
        if (result.kind === "gone") return [];
        if (result.kind === "inactive") return [];
        return [{ ...result.booking, manageToken: token, address: entry.address }];
      })
    );
    if (notice) deps.setBookingNotice(notice);
  } finally {
    if (isAlive()) deps.setVerifying(false);
  }
}

export default function BookingPage({ tenantSlug }: { tenantSlug?: string }) {
  const today = localDateStr(new Date());
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return localDateStr(d);
  })();

  const [barberName, setBarberName] = useState("Barbería");
  const [logo, setLogo] = useState("");
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<BookingConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bookingNotice, setBookingNotice] = useState("");
  const [cancelError, setCancelError] = useState("");
  const didHydrate = useRef(false);

  const freeCount = slots.filter((s) => s.free).length;
  const selectedServiceDetails = services.find((service) => service.name === selectedService);
  const bookingTokensKey = bookings.map((b) => b.manageToken || "").join(",");

  useEffect(() => {
    document.title = barberName
      ? `${barberName} · Reservá tu turno online`
      : "Reservá tu turno online";
  }, [barberName]);

  useEffect(() => {
    // Se hidrata en un microtask: evita renders en cascada desde el efecto y
    // el doble ciclo de efectos de React StrictMode en desarrollo.
    queueMicrotask(() => {
      if (didHydrate.current) return;
      didHydrate.current = true;
      const stored = loadStoredBookings();
      const activeList = stored.filter(isBookingActive);
      const inactive = stored.find((entry) => !isBookingActive(entry));
      setBookings(activeList);
      setHydrated(true);
      setTermsAccepted(loadTermsAccepted());
      if (inactive) setBookingNotice(inactiveNotice(inactive));
      if (activeList.length > 0) {
        // Verificamos en segundo plano sin bloquear la página.
        void verifyBookings(
          activeList.map((entry) => entry.manageToken || "").filter(Boolean),
          { setBookings, setVerifying, setBookingNotice }
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const tokens = bookingTokensKey.split(",").filter(Boolean);
    if (tokens.length === 0) return;
    let alive = true;

    const syncBookings = () => {
      if (!alive) return;
      void verifyBookings(tokens, { setBookings, setVerifying, setBookingNotice }, () => alive);
    };

    const intervalId = window.setInterval(syncBookings, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncBookings();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hydrated, bookingTokensKey]);

  // Mantener la lista de turnos guardada en el dispositivo.
  useEffect(() => {
    if (!hydrated) return;
    persistBookings(bookings);
  }, [hydrated, bookings]);

  useEffect(() => {
    let cancelled = false;
    const requestedDate = date || localDateStr(new Date());
    getAvailability(requestedDate, selectedService, tenantSlug)
      .then((data) => {
        if (cancelled) return;
        setBarberName(data.barberName);
        setLogo(data.imgLogo || "");
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
  }, [date, selectedService, tenantSlug]);

  async function refreshSlots() {
    try {
      const data = await getAvailability(date || today, selectedService, tenantSlug);
      setBarberName(data.barberName);
      setLogo(data.imgLogo || "");
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
    if (!termsAccepted) {
      setError("Aceptá los términos para confirmar el turno");
      return;
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError("Ingresá tu nombre y un teléfono válido");
      return;
    }
    setSubmitting(true);
    setError("");
    persistTermsAccepted();
    try {
      const booking = await createBooking({
        name: name.trim(),
        phone: phone.trim(),
        service: selectedService,
        date,
        time: selectedSlot,
      }, tenantSlug);
      setBookings((prev) =>
        booking.manageToken
          ? [booking, ...prev.filter((entry) => entry.manageToken !== booking.manageToken)]
          : prev
      );
      setBookingNotice(
        `Turno reservado: ${booking.service} · ${formatDate(booking.date)} · ${booking.time} h. Queda guardado en este dispositivo.`
      );
      setCancelError("");
      setStep(1);
      setDate("");
      setSelectedSlot("");
      setSelectedService("");
      window.requestAnimationFrame(() =>
        document.getElementById("mis-turnos")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
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

  function acceptTerms() {
    persistTermsAccepted();
    setTermsAccepted(true);
  }

  async function handleCancelBooking(token: string) {
    if (cancellingToken) return;
    const booking = bookings.find((entry) => entry.manageToken === token);
    if (booking) setBookingToCancel(booking);
  }

  async function confirmCancelBooking() {
    if (!bookingToCancel?.manageToken || cancellingToken) return;
    const token = bookingToCancel.manageToken;
    setCancellingToken(token);
    setCancelError("");
    try {
      await cancelBooking(token);
      setBookings((prev) => prev.filter((entry) => entry.manageToken !== token));
      setBookingNotice("El turno fue cancelado y el horario ya quedó liberado.");
      setBookingToCancel(null);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "No pudimos cancelar el turno");
    } finally {
      setCancellingToken(null);
    }
  }

  if (!hydrated) {
    return (
      <main className="booking-bg grid min-h-[100svh] place-items-center px-4">
        <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-sm font-semibold text-[var(--muted)]">
          Buscando tus turnos…
        </p>
      </main>
    );
  }

  return (
    <div className="booking-bg">
      <Navbar nombre={barberName} logo={logo} tenantSlug={tenantSlug || null} />
      <div className="flex flex-col gap-4 sm:gap-5 max-w-[720px] w-full mx-auto pt-20 sm:pt-24 px-3.5 sm:px-5 pb-12 sm:pb-16">

        {bookingNotice && (
          <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
            {bookingNotice}
          </p>
        )}

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
            {bookings.length > 0 && (
              <a
                href="#mis-turnos"
                className="mt-1 inline-flex min-h-10 items-center justify-center rounded-full border border-white/30 bg-black/25 px-4 text-xs font-extrabold text-white backdrop-blur-sm transition hover:bg-black/40"
              >
                Ver mis turnos ({bookings.length})
              </a>
            )}
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

        {/* Mis turnos */}
        {bookings.length > 0 && (
          <section
            id="mis-turnos"
            aria-labelledby="mis-turnos-titulo"
            className="scroll-mt-24 bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-3.5 sm:p-[22px] flex flex-col gap-3 sm:gap-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="mis-turnos-titulo"
                className="text-[19px] sm:text-[26px] font-bold tracking-[-0.3px] flex items-center gap-2"
              >
                Tus turnos
                <span className="inline-grid place-items-center min-w-6 h-6 sm:min-w-7 sm:h-7 px-1.5 rounded-full bg-accent/15 text-accent text-[12px] sm:text-[13px] font-extrabold">
                  {bookings.length}
                </span>
              </h2>
              {verifying && (
                <span className="text-xs font-semibold text-[var(--muted)]">Actualizando…</span>
              )}
            </div>
            <p className="text-[var(--muted)] text-[13px] sm:text-sm -mt-1">
              Se guardan en este dispositivo. Volvé cuando quieras para cancelarlos.
            </p>
            {cancelError && (
              <p role="alert" className="text-sm font-semibold text-[var(--red)]">{cancelError}</p>
            )}
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {bookings.map((booking) => (
                <TurnoCard
                  key={booking.manageToken || booking._id}
                  booking={booking}
                  cancelling={cancellingToken === booking.manageToken}
                  disabled={Boolean(cancellingToken)}
                  onCancel={() => {
                    if (booking.manageToken) handleCancelBooking(booking.manageToken);
                  }}
                />
              ))}
            </ul>
          </section>
        )}

        <ConfirmDialog
          open={Boolean(bookingToCancel)}
          title="¿Cancelar este turno?"
          description="El horario quedará libre para otra persona. Esta acción no se puede deshacer."
          detail={bookingToCancel ? `${bookingToCancel.service} · ${formatDate(bookingToCancel.date)} · ${bookingToCancel.time} h` : undefined}
          confirmLabel="Cancelar turno"
          loading={Boolean(cancellingToken)}
          onConfirm={confirmCancelBooking}
          onCancel={() => setBookingToCancel(null)}
        />

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
                className={`group w-full min-h-[84px] sm:min-h-[92px] text-left bg-[var(--card-2)] border rounded-[17px] p-3 sm:p-3.5 flex items-center gap-3.5 text-[var(--text)] transition-all active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                  selectedService === s.name
                    ? "border-[var(--accent)] bg-accent/10 shadow-[0_8px_24px_rgba(212,168,83,0.12)]"
                    : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--card)]"
                }`}
              >
                <ServiceThumb service={s.name} img={s.img} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[15px] sm:text-[16px] font-semibold">
                    {s.name}
                  </strong>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2 py-[3px] text-[11.5px] leading-none text-[var(--muted)] whitespace-nowrap">
                      {s.duration} min
                    </span>
                    <span className="text-[13.5px] font-bold tabular-nums text-accent">
                      {currency(s.price)}
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bg-soft)] text-[15px] leading-none text-[var(--muted)] transition group-hover:bg-accent/15 group-hover:text-accent"
                >
                  ›
                </span>
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
            <Step n={2} /> ¿Qué día te queda cómodo?
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
              tenantSlug={tenantSlug}
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
            label="Cambiar servicio"
            onClick={() => {
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
          <SelectionSummary
            service={selectedService}
            date={formatDate(date)}
            price={selectedServiceDetails?.price}
            duration={selectedServiceDetails?.duration}
          />
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
              <Step n={4} /> Confirmá tus datos
            </h2>
            <SelectionSummary
              service={selectedService}
              date={`${formatDate(date)} · ${selectedSlot} h`}
              price={selectedServiceDetails?.price}
              duration={selectedServiceDetails?.duration}
            />
            {error && <p role="alert" className="text-[var(--red)] font-semibold">{error}</p>}
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
              <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => {
                    setTermsAccepted(event.target.checked);
                    if (event.target.checked) acceptTerms();
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  Acepto los términos: dejo mis datos para gestionar la reserva y me comprometo a avisar si no puedo asistir.
                </span>
              </label>
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

function BookingProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = [
    { n: 1, label: "Servicio" },
    { n: 2, label: "Fecha" },
    { n: 3, label: "Horario" },
    { n: 4, label: "Datos" },
  ] as const;

  return (
    <nav aria-label="Progreso de la reserva" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)]/70 px-2.5 py-3 sm:px-5 scroll-mt-24">
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
          <span className={`text-[11px] sm:text-[12px] font-bold truncate max-w-full ${item.n === step ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
            {item.label}
          </span>
        </div>
        ))}
      </div>
    </nav>
  );
}

function SelectionSummary({
  service,
  date,
  price,
  duration,
}: {
  service: string;
  date: string;
  price?: number;
  duration?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-soft)] border border-[var(--border)] px-3 py-1.5">
        <strong className="text-[var(--text)]">{service}</strong>
      </span>
      {typeof duration === "number" && (
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5">
          {duration} min
        </span>
      )}
      {typeof price === "number" && (
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 font-bold text-accent">
          {currency(price)}
        </span>
      )}
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

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function TurnoCard({
  booking,
  cancelling,
  disabled,
  onCancel,
}: {
  booking: BookingConfirmation;
  cancelling: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  const d = new Date(`${booking.date}T00:00:00`);
  const month = MONTH_SHORT[d.getMonth()];
  const day = d.getDate();
  const dayShort = DAY_SHORT[d.getDay()];
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-2.5 sm:p-3.5 flex flex-row items-center gap-2.5 sm:gap-4">
      <div className="shrink-0 flex items-center">
        <span className="w-11 sm:w-[58px] rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden text-center">
          <span className="block text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-accent bg-accent/10 py-0.5">
            {month}
          </span>
          <span className="block py-0.5 sm:py-1 text-base sm:text-xl font-bold leading-none">{day}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <strong className="truncate text-[13.5px] sm:text-base">{booking.service}</strong>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] sm:text-sm text-[var(--muted)]">
          <span className="truncate">
            {dayShort} · {booking.time} h
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs font-bold text-emerald-400">
            <i className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400" /> Confirmado
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled || cancelling}
        aria-label={`Cancelar turno de ${booking.service} del ${dayShort} a las ${booking.time}`}
        className="min-h-11 w-auto shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl font-bold text-[12.5px] sm:text-sm text-red-300 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-60"
      >
        {cancelling ? "Cancelando…" : "Cancelar turno"}
      </button>
    </li>
  );
}

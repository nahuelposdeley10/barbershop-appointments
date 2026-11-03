"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import {
  createBooking,
  cancelBooking,
  getManagedBooking,
  getAvailability,
  updateBookingSchedule,
  AvailabilityBooking,
  BookingConfirmation,
  Service,
  Slot,
} from "@/lib/client-api";
import { BarberPole, ServiceThumb } from "./BarberIcons";
import ScheduleCalendar from "./ScheduleCalendar";
import Navbar from "../Navbar";
import ConfirmDialog from "../ConfirmDialog";
import HairCelebration from "./HairCelebration";

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
  if ((!booking.manageToken && !booking.manageId) || !booking.date || !booking.time) return false;
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
  const [bookingHeroImage, setBookingHeroImage] = useState("");
  const [message, setMessage] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingPassword, setBookingPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [celebrationSequence, setCelebrationSequence] = useState(0);
  const [bookings, setBookings] = useState<BookingConfirmation[]>([]);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<BookingConfirmation | null>(null);
  const [bookingToEdit, setBookingToEdit] = useState<BookingConfirmation | null>(null);
  const [bookingChoices, setBookingChoices] = useState<{
    time: string;
    bookings: AvailabilityBooking[];
    canAdd: boolean;
  } | null>(null);
  const [editService, setEditService] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editSlots, setEditSlots] = useState<Slot[]>([]);
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [bookingNotice, setBookingNotice] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelPassword, setCancelPassword] = useState("");
  const didHydrate = useRef(false);
  const timeSectionRef = useRef<HTMLElement>(null);
  const dateSectionRef = useRef<HTMLElement>(null);
  const pendingFocusStep = useRef<2 | 3 | null>(null);

  useEffect(() => {
    if (pendingFocusStep.current !== step || (step !== 2 && step !== 3)) return;
    if (step === 3 && loading) return;
    const frame = window.requestAnimationFrame(() => {
      const section = step === 2 ? dateSectionRef.current : timeSectionRef.current;
      if (!section) return;
      pendingFocusStep.current = null;
      section.focus({ preventScroll: true });
      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, date, loading]);

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
          { setBookings, setBookingNotice }
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
      void verifyBookings(tokens, { setBookings, setBookingNotice }, () => alive);
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
        setBookingHeroImage(data.imgReservar || "");
        setMessage(data.message || "");
        setServices(data.services || []);
        setSlots(data.slots || []);
        setAvailabilityReady(true);
        setInitialLoadError("");
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No pudimos cargar la barbería";
          setError(message);
          setInitialLoadError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, selectedService, tenantSlug]);

  useEffect(() => {
    if (!bookingToEdit || !editDate || !editService) {
      return;
    }
    let cancelled = false;
    getAvailability(editDate, editService, tenantSlug)
      .then((data) => {
        if (cancelled) return;
        setEditSlots(data.slots || []);
        setEditTime((current) =>
          data.slots.some((slot) => slot.time === current && (slot.free || slot.time === bookingToEdit.time))
            ? current
            : ""
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setEditSlots([]);
          setEditError(err instanceof Error ? err.message : "No pudimos cargar los horarios");
        }
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingToEdit, editDate, editService, tenantSlug]);

  useEffect(() => {
    if (!bookingToEdit && !bookingChoices) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editSaving) {
        setBookingChoices(null);
        setBookingToEdit(null);
        setEditError("");
        setEditPassword("");
        setEditSlots([]);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bookingToEdit, bookingChoices, editSaving]);

  async function refreshSlots() {
    try {
      const data = await getAvailability(date || today, selectedService, tenantSlug);
      setBarberName(data.barberName);
      setLogo(data.imgLogo || "");
      setBookingHeroImage(data.imgReservar || "");
      setMessage(data.message || "");
      setServices(data.services || []);
      setSlots(data.slots || []);
      setAvailabilityReady(true);
      setInitialLoadError("");
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
    if (bookingPassword.length < 6 || bookingPassword.length > 72) {
      setError("La contraseña del turno debe tener entre 6 y 72 caracteres");
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
        managePassword: bookingPassword,
      }, tenantSlug);
      setCelebrationSequence((previous) => previous + 1);
      setBookings((prev) =>
        booking.manageToken
          ? [booking, ...prev.filter((entry) => entry.manageToken !== booking.manageToken)]
          : prev
      );
      setBookingNotice(
        `Turno reservado: ${booking.service} · ${formatDate(booking.date)} · ${booking.time} h. Para editarlo, volvé a ese día y tocá el turno reservado.`
      );
      setCancelError("");
      setBookingPassword("");
      setStep(1);
      setDate("");
      setSelectedSlot("");
      setSelectedService("");
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

  function handleCancelBooking(booking: BookingConfirmation) {
    if (cancellingToken) return;
    setCancelError("");
    setCancelPassword("");
    setBookingToCancel(booking);
  }

  function handleEditBooking(booking: BookingConfirmation) {
    setEditError("");
    setEditPassword("");
    setEditService(booking.service);
    setEditDate(booking.date);
    setEditTime(booking.time);
    setEditLoading(true);
    setBookingToEdit(booking);
  }

  function handleEditAvailabilityBooking(booking: AvailabilityBooking) {
    handleEditBooking({
      _id: booking.id,
      name: booking.name,
      phone: "",
      service: booking.service,
      duration: booking.duration,
      price: booking.price,
      date: booking.date,
      time: booking.time,
      status: "confirmed",
      manageId: booking.id,
      managePasswordRequired: true,
    });
  }

  function handleReservedSlotClick(
    reservedBookings: AvailabilityBooking[],
    time: string,
    canAdd: boolean
  ) {
    setBookingChoices({ time, bookings: reservedBookings, canAdd });
  }

  function requestCancelFromEditor() {
    if (!bookingToEdit) return;
    const booking = bookingToEdit;
    closeEditBooking();
    handleCancelBooking(booking);
  }

  function closeEditBooking(force = false) {
    if (editSaving && !force) return;
    setBookingToEdit(null);
    setBookingChoices(null);
    setEditError("");
    setEditPassword("");
    setEditSlots([]);
  }

  async function confirmEditBooking() {
    if (!bookingToEdit || editSaving) return;
    const identifier = bookingToEdit.manageToken || bookingToEdit.manageId || bookingToEdit._id;
    const requiresPassword = Boolean(bookingToEdit.managePasswordRequired || bookingToEdit.manageId);
    if (!editDate || !editTime || !editService) {
      setEditError("Elegí el servicio, la fecha y el horario");
      return;
    }
    if (requiresPassword && editPassword.length < 6) {
      setEditError("Ingresá la contraseña que creaste al reservar");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await updateBookingSchedule(identifier, {
        service: editService,
        date: editDate,
        time: editTime,
        password: requiresPassword ? editPassword : undefined,
        phone: bookingToEdit.phone,
      });
      const merged = {
        ...updated,
        manageToken: bookingToEdit.manageToken,
        manageId: bookingToEdit.manageId,
        managePasswordRequired: bookingToEdit.managePasswordRequired,
      };
      setBookings((prev) => prev.map((entry) => entry._id === bookingToEdit._id ? merged : entry));
      setBookingNotice(`Turno actualizado: ${merged.service} · ${formatDate(merged.date)} · ${merged.time} h.`);
      closeEditBooking(true);
      await refreshSlots();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "No pudimos actualizar el turno");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmCancelBooking() {
    if (!bookingToCancel || cancellingToken) return;
    const identifier = bookingToCancel.manageToken || bookingToCancel.manageId || bookingToCancel._id;
    const requiresPassword = Boolean(bookingToCancel.managePasswordRequired || bookingToCancel.manageId);
    if (requiresPassword && cancelPassword.length < 6) {
      setCancelError("Ingresá la contraseña que creaste al reservar");
      return;
    }
    setCancellingToken(identifier);
    setCancelError("");
    try {
      await cancelBooking(
        identifier,
        requiresPassword ? cancelPassword : undefined,
        bookingToCancel.phone
      );
      setBookings((prev) => prev.filter((entry) => entry._id !== bookingToCancel._id));
      setBookingNotice("El turno fue cancelado y el horario ya quedó liberado.");
      setBookingToCancel(null);
      setCancelPassword("");
      await refreshSlots();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "No pudimos cancelar el turno");
    } finally {
      setCancellingToken(null);
    }
  }

  if (!hydrated || !availabilityReady) {
    return <BookingLoadingState error={initialLoadError} />;
  }

  return (
    <div className="booking-bg">
      {celebrationSequence > 0 && <HairCelebration sequence={celebrationSequence} />}
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
            src={bookingHeroImage || HERO_IMG}
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

        <ConfirmDialog
          open={Boolean(bookingToCancel)}
          title="¿Cancelar este turno?"
          description="El horario quedará libre para otra persona. Esta acción no se puede deshacer."
          detail={bookingToCancel ? `${bookingToCancel.service} · ${formatDate(bookingToCancel.date)} · ${bookingToCancel.time} h` : undefined}
          confirmLabel="Cancelar turno"
          loading={Boolean(cancellingToken)}
          onConfirm={confirmCancelBooking}
          onCancel={() => {
            if (cancellingToken) return;
            setBookingToCancel(null);
            setCancelPassword("");
            setCancelError("");
          }}
        >
          {(bookingToCancel?.managePasswordRequired || bookingToCancel?.manageId) && (
            <div className="mt-4">
              <label className="flex flex-col gap-1.5 text-sm font-bold text-[var(--text)]">
                Contraseña del turno
                <input
                  type="password"
                  value={cancelPassword}
                  onChange={(event) => setCancelPassword(event.target.value)}
                  placeholder="La que elegiste al reservar"
                  minLength={6}
                  maxLength={72}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 font-normal text-[var(--text)]"
                />
              </label>
              {cancelError && <p role="alert" className="mt-2 text-sm font-semibold text-[var(--red)]">{cancelError}</p>}
            </div>
          )}
        </ConfirmDialog>

        {bookingChoices && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-3 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) setBookingChoices(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-choice-title"
              className="max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[26px] border border-accent/35 bg-[var(--card)]"
            >
              <div className="h-1 bg-gradient-to-r from-accent via-amber-300 to-transparent" aria-hidden="true" />
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[1.5px] text-accent">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Gestionar horario
                    </p>
                    <h2 id="booking-choice-title" className="mt-3 text-[22px] font-extrabold tracking-tight sm:text-2xl">Gestioná este horario</h2>
                    <p className="mt-1.5 text-sm leading-5 text-[var(--muted)]">
                      {bookingChoices.bookings.length === 1
                        ? `Hay un turno reservado para las ${bookingChoices.time} h.`
                        : `Hay ${bookingChoices.bookings.length} turnos reservados para las ${bookingChoices.time} h.`}
                      {bookingChoices.canAdd ? " También queda un lugar disponible." : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar selección de turno"
                    onClick={() => setBookingChoices(null)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--muted)] transition hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  {bookingChoices.bookings.map((booking, index) => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        setBookingChoices(null);
                        handleEditAvailabilityBooking(booking);
                      }}
                      className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-left transition hover:border-accent/50 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent" aria-hidden="true">
                        <span className="text-sm font-extrabold">{index + 1}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-[var(--text)]">{booking.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{booking.service} · {booking.time} h</span>
                      </span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-accent" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  ))}
                  {bookingChoices.canAdd && (
                    <button
                      type="button"
                      onClick={() => {
                        const time = bookingChoices.time;
                        setBookingChoices(null);
                        setSelectedSlot(time);
                        setStep(4);
                        setError("");
                      }}
                      className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-3 text-left text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-lg font-bold" aria-hidden="true">
                        +
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">Agregar turno</span>
                        <span className="mt-0.5 block truncate text-xs text-emerald-200/75">{bookingChoices.time} h · queda un lugar disponible</span>
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setBookingChoices(null)}
                  className="mt-4 min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--muted)] transition hover:border-accent/40 hover:text-[var(--text)]"
                >
                  Cerrar
                </button>
              </div>
            </section>
          </div>
        )}

        {bookingToEdit && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-3 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeEditBooking();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-booking-title"
              className="max-h-[min(calc(100dvh-4rem),680px)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[26px] border border-accent/35 bg-[var(--card)]"
            >
              <div className="h-1 bg-gradient-to-r from-accent via-amber-300 to-transparent" aria-hidden="true" />
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[1.5px] text-accent">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 8v4l2.5 2.5" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                      Editar reserva
                    </p>
                    <h2 id="edit-booking-title" className="mt-3 text-[22px] font-extrabold tracking-tight sm:text-2xl">Modificá tu turno</h2>
                    <p className="mt-1.5 max-w-md text-sm leading-5 text-[var(--muted)]">
                      Elegí un nuevo servicio, fecha u horario. El cambio se confirma solo si sigue disponible.
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
                      Cliente: <span className="text-[var(--text)]">{bookingToEdit.name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar editor de turno"
                    onClick={() => closeEditBooking()}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--muted)] transition hover:border-accent/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <Field label="Servicio">
                    <select
                      value={editService}
                      onChange={(event) => {
                        setEditService(event.target.value);
                        setEditTime("");
                        setEditLoading(true);
                        setEditError("");
                      }}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-[var(--text)]"
                    >
                      {services.map((service) => <option key={service.name} value={service.name}>{service.name}</option>)}
                    </select>
                    </Field>
                  </div>
                  <Field label="Fecha">
                    <input
                      type="date"
                      value={editDate}
                      min={today}
                      max={maxDate}
                      onChange={(event) => {
                        setEditDate(event.target.value);
                        setEditTime("");
                        setEditLoading(true);
                        setEditError("");
                      }}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-[var(--text)]"
                    />
                  </Field>
                  <Field label="Horario">
                    <select
                      value={editTime}
                      onChange={(event) => setEditTime(event.target.value)}
                      disabled={editLoading || editSlots.length === 0}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-[var(--text)] disabled:opacity-60"
                    >
                      <option value="">{editLoading ? "Cargando horarios…" : "Elegí un horario"}</option>
                      {editSlots.filter((slot) => slot.free || slot.time === bookingToEdit.time).map((slot) => (
                        <option key={slot.time} value={slot.time}>{slot.time} h</option>
                      ))}
                    </select>
                  </Field>
                  <div className="col-span-2">
                    {(bookingToEdit.managePasswordRequired || bookingToEdit.manageId) && (
                      <Field label="Contraseña del turno">
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(event) => setEditPassword(event.target.value)}
                        placeholder="La que elegiste al reservar"
                        minLength={6}
                        maxLength={72}
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-3 text-[var(--text)]"
                      />
                      </Field>
                    )}
                  </div>

                  {editError && <p role="alert" className="text-sm font-semibold text-[var(--red)]">{editError}</p>}
                </div>
                <div className="sticky bottom-0 z-10 -mb-4 mt-4 flex items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] py-4 sm:-mb-6 sm:pb-6">
                  <button type="button" disabled={editSaving} onClick={requestCancelFromEditor} className="min-h-10 shrink-0 rounded-lg px-2 text-[11px] font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50 sm:px-3 sm:text-xs">Cancelar</button>
                  <button type="button" disabled={editSaving} onClick={() => closeEditBooking()} className="min-h-10 shrink-0 rounded-lg border border-[var(--border)] px-3 text-xs font-bold text-[var(--muted)] transition hover:border-accent/40 hover:text-[var(--text)] disabled:opacity-50">Volver</button>
                  <button type="button" disabled={editSaving || editLoading || !editTime} onClick={confirmEditBooking} className="min-h-10 flex-1 rounded-lg bg-accent px-3 text-xs font-extrabold text-[#1a1406] transition hover:bg-accent-hover disabled:opacity-60">{editSaving ? "Guardando…" : "Guardar cambio"}</button>
                </div>
              </div>
            </section>
          </div>
        )}

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
                  pendingFocusStep.current = 2;
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
        {step === 2 && <section ref={dateSectionRef} tabIndex={-1} aria-labelledby="booking-date-title" className="scroll-mt-20 bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 id="booking-date-title" className="text-[17px] font-bold">
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
                pendingFocusStep.current = 3;
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
        {step === 3 && date && <section ref={timeSectionRef} tabIndex={-1} aria-labelledby="booking-time-title" className="scroll-mt-20 bg-[var(--card)] border border-[var(--accent)] rounded-[22px] sm:rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5 sm:gap-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
          <h2 id="booking-time-title" className="text-[17px] font-bold">
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-1.5 sm:gap-2">
                {slots.map((slot) => {
                  const reservedBookings = slot.bookings || [];
                  if (reservedBookings.length > 0) {
                    const hasAvailableCapacity = slot.free;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        aria-label={`Gestionar el horario de las ${slot.time}`}
                        title={reservedBookings.map((booking) => `${booking.name} · ${booking.service}`).join(" / ")}
                        onClick={() => handleReservedSlotClick(reservedBookings, slot.time, hasAvailableCapacity)}
                        className="group relative col-span-1 flex min-h-10 min-w-0 items-center justify-center overflow-hidden rounded-xl border border-accent/40 bg-accent/[0.08] text-[var(--text)] transition hover:border-accent/75 focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {hasAvailableCapacity && (
                          <>
                            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-accent/[0.15] transition group-hover:bg-accent/[0.22]" />
                            <span aria-hidden="true" className="absolute inset-y-0 right-0 w-1/2 border-l border-emerald-400/55 bg-[#0c3b2f] transition group-hover:bg-[#124d3c]" />
                          </>
                        )}
                        {!hasAvailableCapacity && <span aria-hidden="true" className="absolute inset-0 bg-accent/[0.15] transition group-hover:bg-accent/[0.22]" />}
                        <span aria-hidden="true" className="relative z-10 text-[13px] font-extrabold tabular-nums">
                          {slot.time}
                        </span>
                        <span aria-hidden="true" className={`absolute top-1/2 z-10 -translate-y-1/2 text-accent opacity-80 transition group-hover:opacity-100 ${hasAvailableCapacity ? "left-1/4 -translate-x-1/2" : "right-1.5"}`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15.5 5.5 3 3M4 20l4.5-1 11-11a2.1 2.1 0 0 1 3-3l-11 11L4 20Z" />
                          </svg>
                        </span>
                      </button>
                    );
                  }
                  const lleno = !slot.free;
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
                  <i className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Disponible
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                  <i className="w-2.5 h-2.5 rounded-full bg-accent" /> Reservado · editable
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
            <form className="flex flex-col gap-3 sm:gap-3.5" onSubmit={handleSubmit}>
              <Field label="Nombre">
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-sm text-[var(--text)] sm:rounded-xl sm:px-3.5 sm:py-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </Field>
              <Field label="Teléfono / WhatsApp">
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-sm text-[var(--text)] sm:rounded-xl sm:px-3.5 sm:py-3"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 1155667788"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Contraseña para gestionar el turno">
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-sm text-[var(--text)] sm:rounded-xl sm:px-3.5 sm:py-3"
                  type="password"
                  value={bookingPassword}
                  onChange={(e) => setBookingPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
                <span className="text-[11px] font-normal leading-4 text-[var(--muted)] sm:text-xs sm:leading-5">
                  Solo se usa para verificar ediciones o cancelaciones. Guardala para gestionar tu turno desde cualquier dispositivo.
                </span>
              </Field>
              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] p-2.5 text-[13px] leading-5 text-[var(--muted)] sm:rounded-xl sm:gap-3 sm:p-3 sm:text-sm">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => {
                    setTermsAccepted(event.target.checked);
                    if (event.target.checked) acceptTerms();
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] sm:h-5 sm:w-5"
                />
                <span>
                  Acepto los términos: dejo mis datos para gestionar la reserva y me comprometo a avisar si no puedo asistir.
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between sm:gap-2.5">
                <button
                  type="button"
                  aria-label="Cambiar horario"
                  title="Cambiar horario"
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card-2)] px-2 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] sm:w-auto sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
                  onClick={() => {
                    setStep(3);
                  }}
                >
                  Cambiar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  aria-label="Confirmar turno"
                  title="Confirmar turno"
                  className="min-w-0 rounded-lg bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] px-2 py-2 text-xs font-extrabold text-[#1a1406] disabled:opacity-60 sm:w-auto sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  {submitting ? "Guardando…" : "Confirmar"}
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

function BookingLoadingState({ error }: { error?: string }) {
  return (
    <main className="booking-bg grid min-h-[100svh] place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-[26px] border border-[var(--border)] bg-[var(--card)] px-6 py-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <span className="text-[10px] font-extrabold uppercase tracking-[3px] text-accent">BarberYá</span>
        <BarberPole className="mt-4 w-44 h-[8px]" />
        {error ? (
          <>
            <p role="alert" className="mt-5 text-sm font-bold text-[var(--red)]">No pudimos cargar esta barbería</p>
            <p className="mt-2 text-sm leading-5 text-[var(--muted)]">Revisá tu conexión e intentá nuevamente.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 rounded-xl bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] px-5 py-3 text-sm font-extrabold text-[#1a1406]"
            >
              Reintentar
            </button>
          </>
        ) : (
          <div role="status" aria-live="polite" className="mt-5 flex flex-col items-center gap-3">
            <span className="grid h-10 w-10 animate-spin place-items-center rounded-full border-4 border-[var(--border)] border-t-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-[var(--text)]">Cargando la barbería…</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Preparando servicios, horarios y reservas</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

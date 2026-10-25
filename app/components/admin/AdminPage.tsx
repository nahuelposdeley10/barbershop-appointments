"use client";

import { useEffect, useRef, useState } from "react";
import {
  adminCreateBooking,
  adminDeleteBooking,
  adminGetBookings,
  adminGetRevenue,
  adminGetSettings,
  adminUpdateBooking,
  adminUpdateSettings,
  adminUploadImage,
  superadminCreateTenant,
  superadminGetTenants,
  AdminBooking,
  AdminRevenue,
  SuperadminTenant,
  Settings,
} from "@/lib/client-api";
import { BarberPole, ServiceIcon } from "../booking/BarberIcons";
import Navbar, { type AdminPanelTab } from "../Navbar";
import ConfirmDialog from "../ConfirmDialog";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  done: "Completado",
};
const AGENDA_PAGE_SIZE = 8;

/** Clase de color del chip. Los turnos viejos ("pending") se ven como activos. */
function statusClass(status: string) {
  if (status === "cancelled") return "cancelled";
  if (status === "done") return "done";
  return "confirmed";
}

/** "1 turno" / "3 turnos" */
function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

function shiftDate(dateStr: string, amount: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDateStr(date);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatRevenueDate(date: string) {
  if (!date) return "Desde el inicio";
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function revenuePeriodLabel(unit: "día" | "semana" | "mes", offset: number) {
  if (offset === 0) {
    if (unit === "día") return "Día actual";
    return unit === "semana" ? "Período actual" : "Mes actual";
  }
  return `Hace ${offset} ${unit}${offset === 1 ? "" : unit === "semana" ? "s" : unit === "mes" ? "es" : "s"}`;
}

type RevenueIconName = "calendar" | "week" | "month" | "coins";
type RevenueTone = "blue" | "accent" | "amber" | "green";

const revenueToneClasses: Record<RevenueTone, { border: string; icon: string; line: string }> = {
  blue: {
    border: "border-blue-400/25",
    icon: "bg-blue-400/10 text-blue-300",
    line: "from-blue-400/70",
  },
  accent: {
    border: "border-accent/30",
    icon: "bg-accent/10 text-accent",
    line: "from-accent/80",
  },
  amber: {
    border: "border-amber-300/25",
    icon: "bg-amber-300/10 text-amber-200",
    line: "from-amber-300/70",
  },
  green: {
    border: "border-emerald-400/25",
    icon: "bg-emerald-400/10 text-emerald-300",
    line: "from-emerald-400/70",
  },
};

function RevenueIcon({ name }: { name: RevenueIconName }) {
  const paths = {
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
    week: <><path d="M4 19.5V10M9.3 19.5V5M14.7 19.5v-7M20 19.5V3.5" /><path d="M3 19.5h18" /></>,
    month: <><path d="M4 19.5V10M9.3 19.5V5M14.7 19.5v-7M20 19.5V3.5" /><path d="m3 8 5-3 5 4 7-5" /></>,
    coins: <><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6M4.5 11v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-5" /></>,
  }[name];

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );
}

function RevenueCard({
  label,
  period,
  periodCaption,
  icon,
  tone = "accent",
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
}: {
  label: string;
  period: AdminRevenue["today"];
  periodCaption?: string;
  icon: RevenueIconName;
  tone?: RevenueTone;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  const navigable = Boolean(onPrevious && onNext);
  const colors = revenueToneClasses[tone];
  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-soft)] p-4 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/15 sm:p-5 ${colors.border}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${colors.line} to-transparent`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${colors.icon}`}>
            <RevenueIcon name={icon} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text)]">{label}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-[var(--muted)]">
              {periodCaption || `${formatRevenueDate(period.from)} – ${formatRevenueDate(period.to)}`}
            </p>
          </div>
        </div>
        {navigable ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrevious}
              disabled={previousDisabled}
              aria-label={`Ver ${label.toLowerCase()} anterior`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m14.5 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              aria-label={`Ver ${label.toLowerCase()} siguiente`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m9.5 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300">Cobrado</p>
          <p className="mt-1 text-[28px] font-black tracking-tight text-[var(--text)]">{formatMoney(period.collected)}</p>
        </div>
        <span className="mb-1 shrink-0 rounded-full bg-[var(--card-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]">
          {period.appointmentCount} {period.appointmentCount === 1 ? "turno" : "turnos"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 text-xs">
        <div className="rounded-xl bg-[var(--card-2)] p-2.5">
          <p className="text-[var(--muted)]">Total estimado</p>
          <p className="mt-1 font-bold text-[var(--text)]">{formatMoney(period.total)}</p>
        </div>
        <div className="rounded-xl bg-amber-300/[0.06] p-2.5">
          <p className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-300/15 text-amber-200" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v3.75c0 .2.08.39.22.53l2.25 2.25a.75.75 0 0 0 1.06-1.06l-2.03-2.03V6.5Z" clipRule="evenodd" /></svg>
            </span>
            Pendiente
          </p>
          <p className="mt-1 font-bold text-amber-200">{formatMoney(period.pending)}</p>
        </div>
      </div>
    </article>
  );
}

export default function AdminPage({
  token,
  role,
  isImpersonating = false,
  tenantName,
  tenantSlug,
  onEnterTenant,
  onExitImpersonation,
  onLogout,
}: {
  token: string;
  role: "superadmin" | "owner";
  isImpersonating?: boolean;
  tenantName?: string | null;
  tenantSlug?: string | null;
  onEnterTenant?: (tenantId: string) => Promise<void>;
  onExitImpersonation?: () => Promise<void>;
  onLogout: () => void;
}) {
  const today = localDateStr(new Date());
  const [tab, setTab] = useState<AdminPanelTab>(() => {
    if (role === "superadmin") return "superadmin";
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("adminTab");
      if (saved === "config" || saved === "web" || saved === "imagenes" || saved === "agenda" || saved === "resumen") {
        return saved;
      }
    }
    return "agenda";
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [barberosInput, setBarberosInput] = useState("1");
  const [slotMinutesInput, setSlotMinutesInput] = useState("30");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [date, setDate] = useState(today);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const agendaMessageTimerRef = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [manualBookingForm, setManualBookingForm] = useState({
    name: "",
    phone: "",
    service: "",
    date: today,
    time: "",
  });
  const [savingManualBooking, setSavingManualBooking] = useState(false);
  const [agendaMessage, setAgendaMessage] = useState("");
  const [page, setPage] = useState(1);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueRefresh, setRevenueRefresh] = useState(0);
  const [dayRevenueOffset, setDayRevenueOffset] = useState(0);
  const [weekRevenueOffset, setWeekRevenueOffset] = useState(0);
  const [monthRevenueOffset, setMonthRevenueOffset] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [checkingBlock, setCheckingBlock] = useState(false);
  const [blockWarning, setBlockWarning] = useState<{
    date: string;
    ids: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [tenants, setTenants] = useState<SuperadminTenant[]>([]);
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantMessage, setTenantMessage] = useState("");
  const [copiedTenantId, setCopiedTenantId] = useState<string | null>(null);
  const [enteringTenantId, setEnteringTenantId] = useState<string | null>(null);
  const [leavingTenant, setLeavingTenant] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<{ id: string; name: string; service: string; date: string; time: string } | null>(null);
  const [deletingBooking, setDeletingBooking] = useState(false);

  useEffect(() => {
    window.sessionStorage.setItem("adminTab", tab);
  }, [tab]);

  useEffect(() => {
    if (!tenantModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !creatingTenant) setTenantModalOpen(false);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tenantModalOpen, creatingTenant]);

  useEffect(() => {
    if (!manualBookingOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !savingManualBooking) setManualBookingOpen(false);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [manualBookingOpen, savingManualBooking]);

  useEffect(() => {
    if (role !== "owner") return;
    adminGetSettings(token)
      .then((s) => {
        setSettings(s);
        setDraft(JSON.parse(JSON.stringify(s)));
        setBarberosInput(String(s.cantidadBarberos ?? 1));
        setSlotMinutesInput(String(s.slotMinutes ?? 30));
        setAdminEmail(s.adminEmail || "");
        setAdminPassword("");
      })
      .catch((e) => setError(e.message));
  }, [token, role]);

  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    adminGetRevenue(token, {
      dayOffset: dayRevenueOffset,
      weekOffset: weekRevenueOffset,
      monthOffset: monthRevenueOffset,
    })
      .then((summary) => {
        if (!cancelled) setRevenue(summary);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "No pudimos cargar los ingresos");
      })
      .finally(() => {
        if (!cancelled) setRevenueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, role, revenueRefresh, dayRevenueOffset, weekRevenueOffset, monthRevenueOffset]);

  useEffect(() => {
    if (role !== "owner" || tab !== "agenda") return;
    let cancelled = false;
    adminGetBookings(token, { date, status: status || undefined })
      .then((list) => {
        if (!cancelled) {
          setBookings(list);
          setPage(1);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, role, tab, date, status]);

  useEffect(() => {
    if (role !== "superadmin" || tab !== "superadmin") return;
    superadminGetTenants(token)
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar las barberías"));
  }, [token, role, tab]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setStatusMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [statusMenuOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!datePickerRef.current?.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDatePickerOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    return () => {
      if (agendaMessageTimerRef.current !== null) {
        window.clearTimeout(agendaMessageTimerRef.current);
      }
    };
  }, []);

  function showAgendaMessage(message: string) {
    setAgendaMessage(message);
    if (agendaMessageTimerRef.current !== null) {
      window.clearTimeout(agendaMessageTimerRef.current);
    }
    agendaMessageTimerRef.current = window.setTimeout(() => {
      setAgendaMessage("");
      agendaMessageTimerRef.current = null;
    }, 4200);
  }

  async function changeStatus(id: string, newStatus: string) {
    setError("");
    try {
      await adminUpdateBooking(
        token,
        id,
        newStatus === "done" ? { status: "done", paymentStatus: "paid" } : newStatus
      );
      const list = await adminGetBookings(token, { date, status: status || undefined });
      setBookings(list);
      setRevenueRefresh((value) => value + 1);
      showAgendaMessage(newStatus === "done" ? "Turno marcado como completado y sumado a cobrado." : "Estado del turno actualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTenant(true);
    setTenantMessage("");
    setError("");
    try {
      const created = await superadminCreateTenant(tenantForm);
      setTenantMessage(`Barbería creada: ${created.name}. El dueño ya puede ingresar con su email.`);
      setTenantForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
      setTenants(await superadminGetTenants(token));
      setTenantModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear la barbería");
    } finally {
      setCreatingTenant(false);
    }
  }

  async function copyTenantLink(tenant: SuperadminTenant) {
    const link = `${window.location.origin}/b/${tenant.slug}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("copy-failed");
      }
      setCopiedTenantId(tenant._id);
      window.setTimeout(() => {
        setCopiedTenantId((current) => (current === tenant._id ? null : current));
      }, 1800);
    } catch {
      setError("No pudimos copiar el link. Intentá nuevamente.");
    }
  }

  async function enterTenant(tenantId: string) {
    if (!onEnterTenant) return;
    setError("");
    setEnteringTenantId(tenantId);
    try {
      await onEnterTenant(tenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir el panel");
    } finally {
      setEnteringTenantId(null);
    }
  }

  async function leaveTenant() {
    if (!onExitImpersonation) return;
    setError("");
    setLeavingTenant(true);
    try {
      await onExitImpersonation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos volver a barberías");
    } finally {
      setLeavingTenant(false);
    }
  }

  function selectAgendaDate(nextDate: string) {
    if (!nextDate) return;
    setLoading(true);
    setDate(nextDate);
    setDatePickerOpen(false);
    setExpandedBookingId(null);
  }

  function openManualBooking() {
    setError("");
    setAgendaMessage("");
    setManualBookingForm({
      name: "",
      phone: "",
      service: settings?.services[0]?.name || "",
      date,
      time: "",
    });
    setManualBookingOpen(true);
  }

  async function createManualBooking(event: React.FormEvent) {
    event.preventDefault();
    setSavingManualBooking(true);
    setError("");
    setAgendaMessage("");
    try {
      await adminCreateBooking(token, manualBookingForm);
      setDate(manualBookingForm.date);
      const list = await adminGetBookings(token, {
        date: manualBookingForm.date,
        status: status || undefined,
      });
      setBookings(list);
      setRevenueRefresh((value) => value + 1);
      setAgendaMessage("Servicio registrado como completado y sumado al resumen.");
      setManualBookingOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos registrar el servicio");
    } finally {
      setSavingManualBooking(false);
    }
  }

  function selectStatus(nextStatus: string) {
    setLoading(true);
    setStatus(nextStatus);
    setPage(1);
    setExpandedBookingId(null);
  }

  function removeBooking(booking: AdminBooking) {
    setBookingToDelete({
      id: booking._id,
      name: booking.name,
      service: booking.service,
      date: booking.date,
      time: booking.time,
    });
  }

  async function confirmRemoveBooking() {
    if (!bookingToDelete || deletingBooking) return;
    setDeletingBooking(true);
    setError("");
    try {
      await adminDeleteBooking(token, bookingToDelete.id);
      const list = await adminGetBookings(token, { date, status: status || undefined });
      setBookings(list);
      setRevenueRefresh((value) => value + 1);
      setBookingToDelete(null);
      showAgendaMessage("Turno anulado correctamente. El horario quedó libre.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setDeletingBooking(false);
    }
  }

  function updateDraftService(
    index: number,
    field: string,
    value: string | number
  ) {
    if (!draft) return;
    const services = draft.services.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    setDraft({ ...draft, services });
  }

  function removeService(index: number) {
    if (!draft) return;
    setDraft({ ...draft, services: draft.services.filter((_, i) => i !== index) });
  }

  function addService() {
    if (!draft) return;
    setDraft({
      ...draft,
      services: [...draft.services, { name: "", price: 0, duration: 30, img: "" }],
    });
  }

  function updateDay(index: number, field: string, value: string | boolean) {
    if (!draft) return;
    setDraft({
      ...draft,
      days: draft.days.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    });
  }

  function addBlockDate(date: string) {
    if (!draft || !date) return;
    if (draft.unavailableDates.includes(date)) return;
    setDraft({
      ...draft,
      unavailableDates: [...draft.unavailableDates, date].sort(),
    });
    setNewBlockDate("");
    setBlockWarning(null);
    setError("");
  }

  /** Antes de bloquear, avisa si ese día ya tiene turnos activos. */
  async function requestBlockDate() {
    if (!draft || !newBlockDate) return;
    const date = newBlockDate;
    if (draft.unavailableDates.includes(date)) {
      setError("Ese día ya está en la lista de días sin atención.");
      return;
    }
    setCheckingBlock(true);
    setBlockWarning(null);
    setError("");
    try {
      const list = await adminGetBookings(token, { date });
      const active = list.filter((b) => b.status !== "cancelled" && b.status !== "done");
      if (active.length === 0) {
        addBlockDate(date);
        return;
      }
      setBlockWarning({
        date,
        ids: active.map((b) => b._id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos revisar los turnos de ese día");
    } finally {
      setCheckingBlock(false);
    }
  }

  /** Bloquea el día y cancela de paso los turnos que ya tenía. */
  async function blockDateAndCancelBookings() {
    if (!blockWarning) return;
    const { date: blockedDate, ids } = blockWarning;
    setCheckingBlock(true);
    setError("");
    let failures = 0;
    for (const id of ids) {
      try {
        await adminUpdateBooking(token, id, "cancelled");
      } catch {
        failures += 1;
      }
    }
    setCheckingBlock(false);
    if (failures > 0) {
      setError(
        `No se pudieron cancelar ${plural(failures, "turno")}. Probá de nuevo o bloqueá el día sin cancelarlos.`
      );
      return;
    }
    addBlockDate(blockedDate);
    if (blockedDate === date) {
      try {
        const list = await adminGetBookings(token, { date, status: status || undefined });
        setBookings(list);
      } catch {
        // La agenda se refresca sola al cambiar de día.
      }
    }
  }

  async function handleUploadImage(
    file: File,
    key: "imgHero" | "imgAbout" | "imgReservar" | "imgLogo",
    folder: string
  ) {
    if (!draft) return;
    setUploading(true);
    setUploadError("");
    try {
      const res = await adminUploadImage(token, file, folder);
      setDraft({ ...draft, [key]: res.url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadGaleria(file: File) {
    if (!draft) return;
    setUploading(true);
    setUploadError("");
    try {
      const res = await adminUploadImage(token, file, "galeria");
      setDraft({ ...draft, imgGaleria: [...draft.imgGaleria, res.url] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadProfesional(file: File, index: number) {
    if (!draft) return;
    setUploading(true);
    setUploadError("");
    try {
      const res = await adminUploadImage(token, file, "profesionales");
      const profesionales = draft.profesionales.map((p, i) =>
        i === index ? { ...p, img: res.url } : p
      );
      setDraft({ ...draft, profesionales });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadService(file: File, index: number) {
    if (!draft) return;
    setUploading(true);
    setUploadError("");
    try {
      const res = await adminUploadImage(token, file, "servicios");
      const services = draft.services.map((service, i) =>
        i === index ? { ...service, img: res.url } : service
      );
      setDraft({ ...draft, services });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  /** Deja el servicio sin foto: vuelve a mostrarse el ícono. */
  function clearServiceImage(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      services: draft.services.map((service, i) =>
        i === index ? { ...service, img: "" } : service
      ),
    });
  }

  function updateProfesional(index: number, field: string, value: string | string[]) {
    if (!draft) return;
    const profesionales = draft.profesionales.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    setDraft({ ...draft, profesionales });
  }

  function addProfesional() {
    if (!draft) return;
    setDraft({
      ...draft,
      profesionales: [...draft.profesionales, { nombre: "", rol: "", img: "", tags: [] }],
    });
  }

  function removeProfesional(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      profesionales: draft.profesionales.filter((_, i) => i !== index),
    });
  }

  function removeGaleriaImage(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      imgGaleria: draft.imgGaleria.filter((_, i) => i !== index),
    });
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await adminUpdateSettings(token, {
        ...draft,
        adminEmail: adminEmail.trim(),
        adminPassword,
      });
      setSettings(updated);
      setDraft(JSON.parse(JSON.stringify(updated)));
      setBarberosInput(String(updated.cantidadBarberos ?? 1));
      setSlotMinutesInput(String(updated.slotMinutes ?? 30));
      setAdminEmail(updated.adminEmail || "");
      setAdminPassword("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  const stats = {
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    done: bookings.filter((b) => b.status === "done").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };
  const statusOptions = [
    {
      value: "",
      label: `Todos (${bookings.length})`,
      color: "text-[var(--text)]",
      dot: "bg-[var(--text)]",
      active: "bg-[var(--text)]/[0.08]",
    },
    {
      value: "confirmed",
      label: plural(stats.confirmed, "confirmado"),
      color: "text-blue-400",
      dot: "bg-blue-400",
      active: "bg-blue-400/[0.10]",
    },
    {
      value: "done",
      label: plural(stats.done, "completado"),
      color: "text-emerald-400",
      dot: "bg-emerald-400",
      active: "bg-emerald-400/[0.10]",
    },
    {
      value: "cancelled",
      label: plural(stats.cancelled, "cancelado"),
      color: "text-[var(--muted)]",
      dot: "bg-[var(--muted)]",
      active: "bg-[var(--muted)]/[0.10]",
    },
  ];
  const selectedStatus = statusOptions.find((option) => option.value === status) ?? statusOptions[0];
  const visibleBookings = bookings.filter((booking) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [booking.name, booking.phone, booking.service].some((value) =>
      value.toLowerCase().includes(query)
    );
  });
  const pageCount = Math.max(1, Math.ceil(visibleBookings.length / AGENDA_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedBookings = visibleBookings.slice(
    (currentPage - 1) * AGENDA_PAGE_SIZE,
    currentPage * AGENDA_PAGE_SIZE
  );
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nextBooking = bookings
    .filter((booking) => booking.status === "confirmed")
    .filter((booking) => date !== today || toMinutes(booking.time) >= nowMinutes)
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  // Días sin atención: qué está guardado y qué quedó pendiente en el borrador.
  const savedBlocked = settings?.unavailableDates ?? [];
  const draftBlocked = draft?.unavailableDates ?? [];
  const pendingAdds = draftBlocked.filter((d) => !savedBlocked.includes(d));
  const pendingRemovals = savedBlocked.filter((d) => !draftBlocked.includes(d));

  // ¿Quedó algo en el borrador sin guardar? (avisa junto a los botones de guardar)
  const sinGuardar =
    Boolean(draft && settings) && JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="booking-bg overflow-x-hidden">
      <Navbar
        nombre={settings ? settings.barberName : "Barbería"}
        logo={settings?.imgLogo}
        adminMode
        adminRole={role}
        adminTab={tab}
        onAdminTabChange={setTab}
        tenantSlug={tenantSlug}
        onLogout={onLogout}
      />
      <div className="flex flex-col gap-4 max-w-[720px] lg:max-w-5xl w-full mx-auto pt-20 px-3 pb-10 sm:gap-5 sm:pt-24 sm:px-5 sm:pb-16 lg:pt-28">

        {role === "owner" && (
          <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center gap-3">
              <BarberPole className="w-12 h-[5px] shrink-0 opacity-80" />
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">Panel del barbero</p>
            </div>
            <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">
                  {tab === "agenda" ? "Agenda de turnos" : tab === "resumen" ? "Resumen financiero" : tab === "config" ? "Configuración" : tab === "imagenes" ? "Imágenes" : "Sitio web"}
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {tab === "agenda" ? "Mirá qué turno sigue y actualizá cada servicio en segundos." : "Administrá tu barbería desde un solo lugar."}
                </p>
              </div>
              {tab === "agenda" && <span className="text-xs font-bold text-[var(--muted)]">{formatDate(date)}</span>}
            </div>
          </header>
        )}

        {isImpersonating && role === "owner" && (
          <section className="flex flex-col gap-3 rounded-2xl border border-accent/35 bg-accent/[0.09] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" role="status">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">Modo superadmin</p>
              <p className="mt-1 font-bold text-[var(--text)]">Administrando {tenantName || tenantSlug || "esta barbería"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Los cambios se guardan en este tenant.</p>
            </div>
            <button
              type="button"
              onClick={leaveTenant}
              disabled={leavingTenant}
              className="min-h-11 shrink-0 rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {leavingTenant ? "Volviendo…" : "Volver a barberías"}
            </button>
          </section>
        )}

        {error && (
          <p className="text-[var(--red)] font-semibold bg-red-500/[0.08] border border-red-500/35 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        {tab === "superadmin" && role === "superadmin" && (
          <section className="flex flex-col gap-4 sm:gap-5">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px] flex flex-col gap-4 sm:gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-accent font-extrabold">Superadmin</p>
                <h2 className="text-xl font-bold mt-2">Barberías y dueños</h2>
                <p className="text-sm text-[var(--muted)] mt-2 max-w-2xl">
                  Cada barbería tiene su propia configuración, servicios, agenda y dueño.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setTenantMessage("");
                  setTenantModalOpen(true);
                }}
                className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-bold text-zinc-950 transition hover:bg-accent-hover sm:w-auto"
              >
                <span aria-hidden="true" className="text-xl leading-none">+</span>
                Crear barbería
              </button>
            </div>
            {tenantMessage && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-3.5 py-2.5 text-sm font-semibold text-emerald-400">{tenantMessage}</p>}
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px]">
              <h2 className="font-bold">Barberías existentes</h2>
              {tenants.length === 0 ? (
                <p className="text-sm text-[var(--muted)] mt-3">Todavía no hay barberías migradas.</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 list-none p-0">
                  {tenants.map((tenant) => (
                    <li key={tenant._id} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <strong>{tenant.name}</strong>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">/{tenant.slug} · {tenant.ownerId?.email || "sin dueño"}</p>
                      </div>
                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          onClick={() => enterTenant(tenant._id)}
                          disabled={enteringTenantId !== null}
                          className="min-h-11 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {enteringTenantId === tenant._id ? "Abriendo…" : "Entrar al panel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyTenantLink(tenant)}
                          className="min-h-11 rounded-xl border border-accent/40 px-3 py-2 text-sm font-bold text-accent transition hover:bg-accent/10"
                          aria-label={`Copiar link de ${tenant.name}`}
                        >
                          {copiedTenantId === tenant._id ? "Copiado" : "Copiar link"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {tenantModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-6"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !creatingTenant) setTenantModalOpen(false);
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tenant-modal-title"
                  className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-accent font-extrabold">Nueva barbería</p>
                      <h2 id="tenant-modal-title" className="mt-2 text-xl font-bold">Crear barbería y dueño</h2>
                      <p className="mt-2 text-sm text-[var(--muted)]">La nueva cuenta tendrá su propia agenda y configuración aislada.</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cerrar ventana"
                      disabled={creatingTenant}
                      onClick={() => setTenantModalOpen(false)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] text-xl text-[var(--muted)] transition hover:border-accent hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={createTenant} className="mt-6 grid gap-3 sm:grid-cols-2">
                      <Field label="Nombre de la barbería">
                        <input autoFocus className="input" required value={tenantForm.name} onChange={(e) => setTenantForm((current) => ({ ...current, name: e.target.value }))} placeholder="Barbería Centro" />
                      </Field>
                      <Field label="Identificador / slug">
                        <input className="input" required value={tenantForm.slug} onChange={(e) => setTenantForm((current) => ({ ...current, slug: e.target.value }))} placeholder="barberia-centro" />
                      </Field>
                      <Field label="Email del dueño">
                        <input className="input" required type="email" value={tenantForm.ownerEmail} onChange={(e) => setTenantForm((current) => ({ ...current, ownerEmail: e.target.value }))} placeholder="dueno@barberia.com" />
                      </Field>
                      <Field label="Contraseña inicial">
                        <input className="input" required minLength={4} type="password" value={tenantForm.ownerPassword} onChange={(e) => setTenantForm((current) => ({ ...current, ownerPassword: e.target.value }))} placeholder="Mínimo 4 caracteres" />
                      </Field>
                      <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                        <button type="button" disabled={creatingTenant} onClick={() => setTenantModalOpen(false)} className="min-h-12 rounded-xl border border-[var(--border)] px-5 py-3 font-bold text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={creatingTenant} className="min-h-12 rounded-xl bg-accent px-5 py-3 font-bold text-zinc-950 transition hover:bg-accent-hover disabled:opacity-60">{creatingTenant ? "Creando…" : "Crear barbería"}</button>
                      </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "resumen" && role === "owner" && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-[22px]">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Resumen financiero</p>
                <h2 className="mt-1 text-xl font-bold">Ingresos de tu barbería</h2>
              </div>
              <p className="text-xs text-[var(--muted)]">Cobrado = turnos completados · cancelados no cuentan</p>
            </div>
            {revenueLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {["Hoy", "Esta semana", "Este mes", "Dinero global"].map((label) => (
                  <div key={label} className="h-40 animate-pulse rounded-2xl bg-[var(--bg-soft)]" aria-label={`Cargando ${label}`} />
                ))}
              </div>
            ) : revenue ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <RevenueCard
                  label={dayRevenueOffset === 0 ? "Hoy" : "Por día"}
                  period={revenue.today}
                  icon="calendar"
                  tone="blue"
                  periodCaption={revenuePeriodLabel("día", dayRevenueOffset)}
                  onPrevious={() => setDayRevenueOffset((value) => Math.min(4, value + 1))}
                  onNext={() => setDayRevenueOffset((value) => Math.max(0, value - 1))}
                  previousDisabled={dayRevenueOffset >= 4}
                  nextDisabled={dayRevenueOffset === 0}
                />
                <RevenueCard
                  label="Esta semana"
                  period={revenue.week}
                  icon="week"
                  tone="accent"
                  periodCaption={revenuePeriodLabel("semana", weekRevenueOffset)}
                  onPrevious={() => setWeekRevenueOffset((value) => Math.min(4, value + 1))}
                  onNext={() => setWeekRevenueOffset((value) => Math.max(0, value - 1))}
                  previousDisabled={weekRevenueOffset >= 4}
                  nextDisabled={weekRevenueOffset === 0}
                />
                <RevenueCard
                  label="Este mes"
                  period={revenue.month}
                  icon="month"
                  tone="amber"
                  periodCaption={revenuePeriodLabel("mes", monthRevenueOffset)}
                  onPrevious={() => setMonthRevenueOffset((value) => Math.min(4, value + 1))}
                  onNext={() => setMonthRevenueOffset((value) => Math.max(0, value - 1))}
                  previousDisabled={monthRevenueOffset >= 4}
                  nextDisabled={monthRevenueOffset === 0}
                />
                <RevenueCard label="Dinero global" period={revenue.global} icon="coins" tone="green" periodCaption="Desde el inicio" />
              </div>
            ) : (
              <p className="rounded-xl border border-amber-300/30 bg-amber-300/[0.08] px-3.5 py-3 text-sm text-amber-200">
                Todavía no pudimos cargar el resumen financiero.
              </p>
            )}
          </section>
        )}

        {tab === "agenda" && role === "owner" && (
          <>
            {nextBooking && status === "" && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/[0.08] px-4 py-3.5 sm:px-5" aria-label="Próximo turno">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">Próximo turno</p>
                    <p className="mt-1 truncate text-[15px] font-bold">{nextBooking.time} · {nextBooking.name}</p>
                    <p className="text-[13px] text-[var(--muted)]">{nextBooking.service} · {nextBooking.duration} min</p>
                  </div>
                </div>
                <span className="st confirmed">Confirmado</span>
              </section>
            )}

            <section aria-label="Buscar y filtrar turnos" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px]">
              <div className="flex items-start justify-between gap-3 sm:w-full">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">Buscar y filtrar</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {plural(visibleBookings.length, "turno")} para {formatDate(date)}
                  </p>
                </div>
                <span className="st confirmed sm:hidden">{selectedStatus.label}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:contents">
                <Field label="Buscar" className="min-w-0 sm:min-w-[200px] sm:flex-1">
                  <input
                    className="input"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Nombre, teléfono o servicio"
                    aria-label="Buscar por nombre, teléfono o servicio"
                    type="search"
                  />
                </Field>
                <div ref={statusMenuRef} className="relative min-w-0 sm:hidden">
                  <span className="mb-1.5 block text-sm font-semibold">Filtros</span>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={statusMenuOpen}
                    aria-controls="agenda-status-menu"
                    onClick={() => setStatusMenuOpen((open) => !open)}
                    className={`input flex h-[49px] w-[132px] max-w-full items-center justify-between gap-2 px-3 text-left transition ${
                      statusMenuOpen ? "border-accent shadow-[0_0_0_3px_rgba(212,168,83,0.10)]" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${selectedStatus.dot}`} aria-hidden="true" />
                      <span className={`truncate text-[13px] font-bold ${selectedStatus.color}`}>
                        {selectedStatus.label}
                      </span>
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${statusMenuOpen ? "rotate-180" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {statusMenuOpen && (
                    <div
                      id="agenda-status-menu"
                      role="menu"
                      aria-label="Filtrar por estado"
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(13.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl shadow-black/30"
                    >
                      {statusOptions.map((option) => {
                        const active = option.value === status;
                        return (
                          <button
                            key={option.value || "all"}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => {
                              selectStatus(option.value);
                              setStatusMenuOpen(false);
                            }}
                            className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-bold transition hover:bg-[var(--card-2)] ${
                              active ? `${option.active} ring-1 ring-inset ring-accent/40` : ""
                            }`}
                          >
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} aria-hidden="true" />
                            <span className={`flex-1 ${option.color}`}>{option.label}</span>
                            {active && (
                              <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.333a1 1 0 0 1-1.42.006L3.29 9.293a1 1 0 0 1 1.42-1.406l4.04 4.081 6.54-6.61a1 1 0 0 1 1.414-.068Z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openManualBooking}
                className="min-h-12 w-full shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-accent-hover sm:w-auto"
              >
                + Registrar servicio
              </button>
              <div className="hidden flex-wrap gap-2 border-t border-[var(--border)] pt-3 sm:flex sm:w-full sm:pt-3">
                <Stat
                  cls="text-[var(--text)] border-[var(--border)]"
                  label={status === "" ? `Todos (${bookings.length})` : "Todos"}
                  active={status === ""}
                  onClick={() => selectStatus("")}
                />
                <Stat
                  cls="text-blue-400 border-blue-400/40"
                  label={plural(stats.confirmed, "confirmado")}
                  active={status === "confirmed"}
                  onClick={() => selectStatus(status === "confirmed" ? "" : "confirmed")}
                />
                <Stat
                  cls="text-emerald-400 border-emerald-400/40"
                  label={plural(stats.done, "completado")}
                  active={status === "done"}
                  onClick={() => selectStatus(status === "done" ? "" : "done")}
                />
                <Stat
                  cls="text-[var(--muted)] border-[var(--muted)]/40"
                  label={plural(stats.cancelled, "cancelado")}
                  active={status === "cancelled"}
                  onClick={() => selectStatus(status === "cancelled" ? "" : "cancelled")}
                />
              </div>
            </section>

            {agendaMessage && (
              <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-3.5 py-2.5 text-sm font-semibold text-emerald-400">
                {agendaMessage}
              </p>
            )}

            <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3.5">
              <div ref={datePickerRef} className="sticky top-[4.5rem] z-20 relative flex items-center justify-center gap-2 border-b border-[var(--border)] bg-[var(--card)]/95 pb-3 backdrop-blur sm:top-[5.5rem] lg:top-[8.5rem]">
                <button
                  type="button"
                  aria-label="Ver día anterior"
                  onClick={() => selectAgendaDate(shiftDate(date, -1))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition hover:border-accent hover:text-accent"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m14.5 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-expanded={datePickerOpen}
                  aria-controls="agenda-date-picker"
                  onClick={() => setDatePickerOpen((open) => !open)}
                  className="min-w-0 rounded-xl px-3 py-2 text-center transition hover:bg-[var(--bg-soft)]"
                >
                  <span className="block text-[16px] font-bold sm:text-[17px]">{formatDate(date)}</span>
                  <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                    {datePickerOpen ? "Ocultar calendario" : "Cambiar fecha"}
                  </span>
                  {status !== "" && (
                    <span className="mt-1 block text-xs text-[var(--muted)]">{STATUS_LABELS[status]}</span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Ver día siguiente"
                  onClick={() => selectAgendaDate(shiftDate(date, 1))}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition hover:border-accent hover:text-accent"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m9.5 18 6-6-6-6" />
                  </svg>
                </button>
                {datePickerOpen && (
                  <div
                    id="agenda-date-picker"
                    className="absolute left-1/2 top-[calc(100%+0.5rem)] z-20 w-[min(18rem,calc(100vw-3rem))] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-2xl"
                  >
                    <label className="flex flex-col gap-1.5 text-left text-xs font-bold text-[var(--muted)]">
                      <span>Elegí una fecha</span>
                      <input
                        type="date"
                        className="input"
                        autoFocus
                        value={date}
                        onChange={(event) => selectAgendaDate(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => selectAgendaDate(today)}
                      className="mt-2.5 min-h-10 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold text-[var(--muted)] transition hover:border-accent hover:text-accent"
                    >
                      Volver a hoy
                    </button>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="grid gap-2" aria-label="Cargando turnos">
                  <div className="h-16 animate-pulse rounded-2xl bg-[var(--bg-soft)]" />
                  <div className="h-16 animate-pulse rounded-2xl bg-[var(--bg-soft)]" />
                </div>
              ) : visibleBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] p-5 text-center">
                  {search.trim() ? (
                    <>
                      <p className="font-bold text-[var(--text)]">No encontramos ese turno.</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Probá con otro nombre, teléfono o servicio.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                        }}
                        className="mt-4 min-h-11 rounded-xl border border-accent/40 px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/10"
                      >
                        Limpiar búsqueda
                      </button>
                    </>
                  ) : status ? (
                    <>
                      <p className="font-bold text-[var(--text)]">No hay turnos {STATUS_LABELS[status]?.toLowerCase()}.</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Probá con otro estado o volvé a ver todos.</p>
                      <button
                        type="button"
                        onClick={() => selectStatus("")}
                        className="mt-4 min-h-11 rounded-xl border border-accent/40 px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/10"
                      >
                        Ver todos los turnos
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-[var(--text)]">No hay turnos para esta selección.</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">Podés registrar un servicio hecho sin reserva.</p>
                      <button
                        type="button"
                        onClick={openManualBooking}
                        className="mt-4 min-h-11 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-accent-hover"
                      >
                        Registrar servicio
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0">
                  {paginatedBookings.map((b) => {
                    const expanded = expandedBookingId === b._id;
                    const phoneHref = b.phone ? `tel:${b.phone.replace(/[^\d+]/g, "")}` : undefined;
                    return (
                      <li
                        key={b._id}
                        className={`min-w-0 overflow-hidden rounded-2xl border bg-[var(--bg-soft)] transition ${
                          expanded ? "border-accent/60 shadow-[0_12px_30px_rgba(0,0,0,0.16)]" : "border-[var(--border)]"
                        } ${b.status === "cancelled" ? "booking-cancelled" : ""}`}
                      >
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`booking-details-${b._id}`}
                          onClick={() => setExpandedBookingId((current) => current === b._id ? null : b._id)}
                          className="flex min-h-[74px] w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition hover:bg-[var(--card-2)] sm:min-h-[68px] sm:gap-4 sm:px-4"
                        >
                          <span className="w-12 shrink-0 text-base font-extrabold text-accent sm:w-14 sm:text-lg">{b.time}</span>
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              b.status === "done" ? "bg-emerald-400" : b.status === "cancelled" ? "bg-red-400" : "bg-accent"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-2">
                              <strong className="min-w-0 truncate text-sm sm:text-[15px]">{b.name}</strong>
                              <span className={`st hidden shrink-0 sm:inline-flex ${statusClass(b.status)}`}>
                                {STATUS_LABELS[b.status] || "Confirmado"}
                              </span>
                            </span>
                            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--muted)] sm:text-[13px]">
                              <span className="truncate">{b.service}</span>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0">{b.duration} min</span>
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-sm font-extrabold text-accent sm:block">{formatMoney(Number(b.price || 0))}</span>
                          <span className={`st shrink-0 sm:hidden ${statusClass(b.status)}`}>{STATUS_LABELS[b.status] || "Confirmado"}</span>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`shrink-0 text-[var(--muted)] transition-transform ${expanded ? "rotate-180 text-accent" : ""}`}
                            aria-hidden="true"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>

                        {expanded && (
                          <div id={`booking-details-${b._id}`} className="border-t border-[var(--border)] px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 5.18 2 2 0 0 1 4.11 3h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 10.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
                                </svg>
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Teléfono</span>
                                  {phoneHref ? <a href={phoneHref} className="mt-1 block truncate text-sm font-bold hover:text-accent">{b.phone}</a> : <span className="mt-1 block text-sm font-semibold text-[var(--muted)]">Sin número</span>}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                                </svg>
                                <span>
                                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Duración</span>
                                  <span className="mt-1 block text-sm font-bold">{b.duration} minutos</span>
                                </span>
                              </div>
                              <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                                </svg>
                                <span>
                                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Importe</span>
                                  <span className="mt-1 block text-sm font-extrabold text-accent">{formatMoney(Number(b.price || 0))}</span>
                                  {b.status === "done" && <span className="mt-0.5 block text-[11px] font-bold text-emerald-400">Cobrado</span>}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                              {b.status !== "cancelled" && b.status !== "done" && (
                                <>
                                  <SmallBtn
                                    cls="flex-1 bg-accent text-zinc-950 border-accent hover:bg-accent-hover sm:flex-none"
                                    onClick={() => changeStatus(b._id, "done")}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                                      Marcar como completado
                                    </span>
                                  </SmallBtn>
                                  <SmallBtn
                                    cls="flex-1 bg-red-500/12 text-[var(--red)] border-red-500/40 sm:flex-none"
                                    onClick={() => removeBooking(b)}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                                      Anular turno
                                    </span>
                                  </SmallBtn>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {pageCount > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <span className="text-xs text-[var(--muted)]">Página {currentPage} de {pageCount}</span>
                  <div className="flex gap-2">
                    <SmallBtn
                      cls="bg-[var(--card-2)] text-[var(--muted)] border-[var(--border)]"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </SmallBtn>
                    <SmallBtn
                      cls="bg-[var(--card-2)] text-[var(--muted)] border-[var(--border)]"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={currentPage === pageCount}
                    >
                      Siguiente
                    </SmallBtn>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {manualBookingOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !savingManualBooking) setManualBookingOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="manual-booking-title"
              className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-6"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Carga manual</p>
                  <h2 id="manual-booking-title" className="mt-2 text-xl font-bold">Registrar servicio realizado</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Usalo cuando alguien vino sin reservar. Se guardará como completado y sumará al resumen.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar ventana"
                  disabled={savingManualBooking}
                  onClick={() => setManualBookingOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border)] text-xl text-[var(--muted)] transition hover:border-accent hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <form onSubmit={createManualBooking} className="mt-6 grid gap-3 sm:grid-cols-2">
                <Field label="Servicio">
                  <select
                    className="input"
                    required
                    value={manualBookingForm.service}
                    onChange={(event) => setManualBookingForm((current) => ({ ...current, service: event.target.value }))}
                  >
                    <option value="">Elegí un servicio</option>
                    {(settings?.services || []).map((service) => (
                      <option key={service.name} value={service.name}>
                        {service.name} · {formatMoney(service.price)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nombre del cliente">
                  <input
                    className="input"
                    required
                    minLength={2}
                    maxLength={80}
                    value={manualBookingForm.name}
                    onChange={(event) => setManualBookingForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nombre y apellido"
                  />
                </Field>
                <Field label="Fecha">
                  <input
                    type="date"
                    className="input"
                    required
                    value={manualBookingForm.date}
                    onChange={(event) => setManualBookingForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </Field>
                <Field label="Horario">
                  <input
                    type="time"
                    className="input"
                    required
                    value={manualBookingForm.time}
                    onChange={(event) => setManualBookingForm((current) => ({ ...current, time: event.target.value }))}
                  />
                </Field>
                <Field label="Teléfono (opcional)" className="sm:col-span-2">
                  <input
                    className="input"
                    inputMode="tel"
                    value={manualBookingForm.phone}
                    onChange={(event) => setManualBookingForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Se puede dejar vacío"
                  />
                </Field>
                <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={savingManualBooking}
                    onClick={() => setManualBookingOpen(false)}
                    className="min-h-12 rounded-xl border border-[var(--border)] px-5 py-3 font-bold text-[var(--muted)] transition hover:border-[var(--text)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingManualBooking || !settings?.services.length}
                    className="min-h-12 rounded-xl bg-accent px-5 py-3 font-bold text-zinc-950 transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingManualBooking ? "Guardando…" : "Registrar como completado"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {tab === "config" && draft && (
          <form className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3 sm:gap-3.5" onSubmit={saveSettings}>
            <h2 className="text-[17px] font-bold">Configuración</h2>

            <Field label="Nombre del local / barbería">
              <input
                className="input"
                value={draft.barberName}
                onChange={(e) => setDraft({ ...draft, barberName: e.target.value })}
              />
              <span className="text-[var(--muted)] text-xs font-normal">
                Si lo dejás vacío, arriba se muestra solo el logo (o la tijera).
              </span>
              <span className="text-[var(--muted)] text-xs font-normal">
                Cambiar este nombre no modifica la URL pública ni los links compartidos.
              </span>
            </Field>

            <Field label="Mensaje para los clientes">
              <input
                className="input"
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
            </Field>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Servicios</h3>
            <p className="text-[var(--muted)] text-[13px]">
              La foto de cada servicio es opcional: se ve en la portada y en la tarjeta
              del paso 1 de la reserva. Si la dejás vacía, se muestra el ícono del
              servicio. Se guarda con «Guardar configuración».
            </p>
            <div className="flex flex-col gap-2.5">
              {draft.services.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {s.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.img}
                          alt={s.name || "Servicio"}
                          className="h-12 w-12 shrink-0 rounded-[14px] object-cover"
                        />
                      ) : (
                        <ServiceIcon service={s.name} />
                      )}
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <label
                          className="cursor-pointer text-xs font-bold text-[var(--text)]"
                          style={{ pointerEvents: uploading ? "none" : "auto", opacity: uploading ? 0.5 : 1 }}
                        >
                          <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 hover:border-accent">
                            {uploading ? "Subiendo…" : s.img ? "Cambiar foto" : "Subir foto"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadService(file, i);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {s.img && (
                          <button
                            type="button"
                            className="btn-small-red"
                            onClick={() => clearServiceImage(i)}
                          >
                            Quitar foto
                          </button>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-small-red"
                      onClick={() => removeService(i)}
                      disabled={draft.services.length <= 1}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-[1fr_100px_100px] gap-2">
                    <input
                      className="input"
                      value={s.name}
                      placeholder="Nombre del servicio"
                      onChange={(e) => updateDraftService(i, "name", e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      aria-label={`Precio de ${s.name || `servicio ${i + 1}`}`}
                      value={s.price}
                      onChange={(e) => updateDraftService(i, "price", e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      min={5}
                      step={5}
                      aria-label={`Duración de ${s.name || `servicio ${i + 1}`}`}
                      value={s.duration}
                      onChange={(e) => updateDraftService(i, "duration", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="self-start px-4 py-2.5 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-sm text-[var(--text)] hover:border-[var(--accent)]"
                onClick={addService}
              >
                + Agregar servicio
              </button>
            </div>
            <p className="text-[var(--muted)] text-[13px]">
              Los precios y las duraciones son en $ y en minutos.
            </p>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Horarios de atención</h3>
            <div className="flex flex-col gap-1.5">
              {draft.days.map((d, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[var(--bg-soft)] ${
                    d.enabled ? "" : "opacity-50"
                  }`}
                >
                  <input
                    className="w-[18px] h-[18px] accent-[var(--accent)]"
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => updateDay(i, "enabled", e.target.checked)}
                  />
                  <span className="flex-1 min-w-0 font-bold text-sm">{DAY_NAMES[i]}</span>
                  <span className="flex items-center gap-2">
                    <input
                      className="input-time"
                      type="time"
                      value={d.open}
                      disabled={!d.enabled}
                      onChange={(e) => updateDay(i, "open", e.target.value)}
                    />
                    <span className="text-[var(--muted)]">a</span>
                    <input
                      className="input-time"
                      type="time"
                      value={d.close}
                      disabled={!d.enabled}
                      onChange={(e) => updateDay(i, "close", e.target.value)}
                    />
                  </span>
                </div>
              ))}
            </div>

            <Field label="Separación entre turnos (minutos)">
              <input
                type="number"
                step={1}
                className="input"
                value={slotMinutesInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setSlotMinutesInput(raw);
                  setDraft({
                    ...draft,
                    slotMinutes: raw === "" ? 0 : Number(raw),
                  });
                }}
                onBlur={() => {
                  const value = Math.round(Number(slotMinutesInput));
                  const fallback = settings?.slotMinutes ?? 30;
                  const next =
                    Number.isFinite(value) && value >= 1 ? value : fallback;
                  setSlotMinutesInput(String(next));
                  setDraft({ ...draft, slotMinutes: next });
                }}
              />
            </Field>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Barberos</h3>
            <Field label="Cantidad de barberos (sillas)">
              <input
                type="number"
                min={1}
                step={1}
                className="input"
                value={barberosInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBarberosInput(raw);
                  setDraft({
                    ...draft,
                    cantidadBarberos:
                      raw === "" ? 0 : Math.max(1, Number(raw)),
                  });
                }}
              />
            </Field>
            <p className="text-[var(--muted)] text-[13px]">
              Importante: cada barbero tiene que tener su silla. Si son{" "}
              <strong className="text-[var(--accent)]">3 barberos</strong>, se
              permiten hasta 3 reservas a la misma hora (una por silla). Con 1
              barbero, solo 1 reserva por horario.
            </p>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Días sin atención</h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                type="date"
                className="input"
                value={newBlockDate}
                min={today}
                onChange={(e) => {
                  setNewBlockDate(e.target.value);
                  setBlockWarning(null);
                }}
              />
              <button
                type="button"
                className="px-4 py-3 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
                onClick={requestBlockDate}
                disabled={checkingBlock || !newBlockDate}
              >
                {checkingBlock ? "Revisando…" : "Bloquear día"}
              </button>
            </div>

            {blockWarning && (
              <div
                role="alert"
                className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-3.5 flex flex-col gap-3"
              >
                <p className="text-sm leading-6">
                  <strong>{formatDate(blockWarning.date)}</strong> ya tiene{" "}
                  <strong>{plural(blockWarning.ids.length, "turno")}</strong>. Si
                  bloqueás el día, esos turnos <strong>no se cancelan solos</strong>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-xl text-[13px] font-bold bg-red-500/12 text-[var(--red)] border border-red-500/40"
                    onClick={blockDateAndCancelBookings}
                    disabled={checkingBlock}
                  >
                    Bloquear y cancelar los turnos
                  </button>
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-xl text-[13px] font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
                    onClick={() => addBlockDate(blockWarning.date)}
                    disabled={checkingBlock}
                  >
                    Bloquear igual
                  </button>
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-xl text-[13px] font-bold bg-[var(--card-2)] text-[var(--muted)] border border-[var(--border)]"
                    onClick={() => setBlockWarning(null)}
                    disabled={checkingBlock}
                  >
                    Mejor no
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {pendingRemovals.map((d) => (
                <span
                  key={`quitar-${d}`}
                  className="inline-flex items-center gap-2 bg-[var(--card-2)] border border-dashed border-[var(--border)] px-2.5 py-1.5 rounded-full text-[13px] text-[var(--muted)] line-through"
                >
                  {formatDate(d)}
                  <button
                    type="button"
                    className="text-[13px] leading-none p-0 text-[var(--muted)] hover:text-[var(--text)]"
                    title="Volver a bloquearlo"
                    onClick={() => addBlockDate(d)}
                  >
                    ↺
                  </button>
                </span>
              ))}
              {draft.unavailableDates.map((d) => {
                const sinGuardar = !savedBlocked.includes(d);
                return (
                  <span
                    key={d}
                    className={`inline-flex items-center gap-2 bg-[var(--card-2)] border px-2.5 py-1.5 rounded-full text-[13px] ${
                      sinGuardar ? "border-accent/60 text-accent" : "border-[var(--border)]"
                    }`}
                  >
                    {formatDate(d)}
                    {sinGuardar && (
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-accent">
                        sin guardar
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-[var(--muted)] text-[15px] leading-none p-0 hover:text-[var(--red)]"
                      title="Quitar de la lista"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          unavailableDates: draft.unavailableDates.filter((x) => x !== d),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {draft.unavailableDates.length === 0 && pendingRemovals.length === 0 && (
                <span className="text-[var(--muted)] text-[13px]">Sin días bloqueados.</span>
              )}
            </div>

            <p className="text-[var(--muted)] text-[13px]">
              Los cambios en los días sin atención se aplican al tocar{" "}
              <strong className="text-[var(--text)]">Guardar cambios</strong>, al final del formulario.
              {(pendingAdds.length > 0 || pendingRemovals.length > 0) && (
                <span className="block mt-1 font-semibold text-accent">
                  Sin guardar:{" "}
                  {[
                    pendingAdds.length ? `+${plural(pendingAdds.length, "día bloqueado")}` : "",
                    pendingRemovals.length ? `−${plural(pendingRemovals.length, "día liberado")}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </p>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Acceso</h3>
            <Field label="Email de acceso">
              <input
                type="email"
                className="input w-full max-w-[360px]"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@tubarberia.com"
                autoComplete="username"
              />
            </Field>
            <Field label="Nueva contraseña">
              <input
                type="password"
                className="input w-full max-w-[360px]"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Dejar en blanco para mantenerla"
                autoComplete="new-password"
              />
            </Field>
            <p className="text-[var(--muted)] text-[13px]">
              La contraseña debe tener entre 4 y 128 caracteres. Se guarda como hash y nunca se muestra.
            </p>

            {error && <p className="text-[var(--red)] font-semibold">{error}</p>}
            {saved && <p className="text-emerald-400 font-semibold">Configuración guardada ✓</p>}

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 bg-[var(--card)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
              {sinGuardar && (
                <span className="text-[12.5px] font-bold text-amber-400">
                  ● Cambios sin guardar
                </span>
              )}
            </div>
          </form>
        )}

        {tab === "web" && draft && (
          <form
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px] flex flex-col gap-3 sm:gap-3.5"
            onSubmit={saveSettings}
          >
            <h2 className="text-[17px] font-bold">Sitio web</h2>
            <p className="text-[var(--muted)] text-[13px]">
              Estos datos se muestran en la página principal. El nombre del
              local se edita en la pestaña «Configuración».
            </p>

            <Field label="Slogan (se ve en el pie de página)">
              <input
                className="input"
                value={draft.slogan}
                onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
              />
            </Field>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">
              Portada (Hero)
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Título - línea 1">
                <input
                  className="input"
                  value={draft.heroTitle1}
                  onChange={(e) => setDraft({ ...draft, heroTitle1: e.target.value })}
                />
              </Field>
              <Field label="Título - línea 2">
                <input
                  className="input"
                  value={draft.heroTitle2}
                  onChange={(e) => setDraft({ ...draft, heroTitle2: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción de la portada">
              <textarea
                className="input"
                rows={3}
                value={draft.heroDescription}
                onChange={(e) =>
                  setDraft({ ...draft, heroDescription: e.target.value })
                }
              />
            </Field>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">
              Sobre nosotros
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Título - línea 1">
                <input
                  className="input"
                  value={draft.aboutTitle}
                  onChange={(e) => setDraft({ ...draft, aboutTitle: e.target.value })}
                />
              </Field>
              <Field label="Título - línea 2">
                <input
                  className="input"
                  value={draft.aboutTitle2}
                  onChange={(e) => setDraft({ ...draft, aboutTitle2: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Texto de 'Sobre nosotros'">
              <textarea
                className="input"
                rows={3}
                value={draft.aboutText}
                onChange={(e) => setDraft({ ...draft, aboutText: e.target.value })}
              />
            </Field>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">Contacto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Field label="WhatsApp (solo números, con código de país)">
                <input
                  className="input"
                  value={draft.whatsapp}
                  onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })}
                />
              </Field>
              <Field label="Instagram (URL)">
                <input
                  className="input"
                  value={draft.instagram}
                  onChange={(e) => setDraft({ ...draft, instagram: e.target.value })}
                />
              </Field>
              <Field label="Facebook (URL)">
                <input
                  className="input"
                  value={draft.facebook}
                  onChange={(e) => setDraft({ ...draft, facebook: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className="input"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Field>
            </div>

            <h3 className="text-[15px] font-extrabold text-accent mt-1.5">
              Dirección y mapa
            </h3>
            <Field label="Dirección">
              <input
                className="input"
                value={draft.direccion}
                onChange={(e) => setDraft({ ...draft, direccion: e.target.value })}
              />
            </Field>
            <Field label="Consulta del mapa (Google Maps)">
              <input
                className="input"
                value={draft.mapaQuery}
                onChange={(e) => setDraft({ ...draft, mapaQuery: e.target.value })}
              />
            </Field>
            <Field label="Link de Google Maps al tocar el mapa">
              <input
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://maps.app.goo.gl/..."
                value={draft.mapLink}
                onChange={(e) => setDraft({ ...draft, mapLink: e.target.value })}
              />
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                Pegá el enlace de Compartir de Google Maps. El mapa y la dirección abrirán ese destino.
              </p>
            </Field>

            {error && <p className="text-[var(--red)] font-semibold">{error}</p>}
            {saved && (
              <p className="text-emerald-400 font-semibold">
                Sitio web actualizado ✓
              </p>
            )}

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 bg-[var(--card)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar sitio web"}
              </button>
              {sinGuardar && (
                <span className="text-[12.5px] font-bold text-amber-400">
                  ● Cambios sin guardar
                </span>
              )}
            </div>
          </form>
        )}

        {tab === "imagenes" && draft && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 sm:p-[22px] flex flex-col gap-4 sm:gap-5">
            <div>
              <h2 className="text-[17px] font-bold">Imágenes del sitio</h2>
              <p className="text-[var(--muted)] text-[13px] mt-1">
                Subí las fotos que se muestran en la página principal. Se cargan
                automáticamente en Cloudinary.
              </p>
            </div>

            {(uploadError || error) && (
              <p className="text-[var(--red)] font-semibold bg-red-500/[0.08] border border-red-500/35 rounded-xl px-3.5 py-2.5">
                {uploadError || error}
              </p>
            )}

            <h3 className="text-[15px] font-extrabold text-accent mt-1">Logo</h3>
            <p className="text-[var(--muted)] text-[13px]">
              Se muestra arriba a la izquierda en la web y en la reserva. Si no subís
              nada, se usa el logo actual (tijera + nombre). Ideal: PNG con fondo
              transparente y formato horizontal. Se guarda con «Guardar imágenes».
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ImageField
                label="Logo de la barbería"
                value={draft.imgLogo}
                uploading={uploading}
                onChange={(file) => handleUploadImage(file, "imgLogo", "logo")}
                onClear={() => setDraft({ ...draft, imgLogo: "" })}
                fit="contain"
                aspect="aspect-[3/1]"
                emptyLabel="Logo actual (tijera + nombre)"
              />
            </div>

            <h3 className="text-[15px] font-extrabold text-accent mt-1">Portada y secciones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ImageField
                label="Portada (Hero)"
                value={draft.imgHero}
                uploading={uploading}
                onChange={(file) => handleUploadImage(file, "imgHero", "hero")}
                onClear={() => setDraft({ ...draft, imgHero: "" })}
              />
              <ImageField
                label="Sobre nosotros"
                value={draft.imgAbout}
                uploading={uploading}
                onChange={(file) => handleUploadImage(file, "imgAbout", "about")}
                onClear={() => setDraft({ ...draft, imgAbout: "" })}
              />
              <ImageField
                label="Sección Reservar"
                value={draft.imgReservar}
                uploading={uploading}
                onChange={(file) => handleUploadImage(file, "imgReservar", "reservar")}
                onClear={() => setDraft({ ...draft, imgReservar: "" })}
              />
            </div>

            <h3 className="text-[15px] font-extrabold text-accent mt-1">Fotos de servicios</h3>
            <p className="text-[var(--muted)] text-[13px]">
              Opcional, una por servicio. Se muestra en la portada y en la tarjeta del
              paso 1 de la reserva. Si la dejás vacía, se usa el ícono del servicio.
              Se guarda con «Guardar imágenes».
            </p>
            <div className="flex flex-col gap-2.5">
              {draft.services.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3"
                >
                  {s.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.img}
                      alt={s.name || "Servicio"}
                      className="h-12 w-12 shrink-0 rounded-[14px] object-cover"
                    />
                  ) : (
                    <ServiceIcon service={s.name} />
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-semibold">
                      {s.name || `Servicio ${i + 1}`}
                    </strong>
                    <span className="text-[12px] text-[var(--muted)]">
                      {s.img ? "Foto cargada" : "Sin foto · se muestra el ícono"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <label
                      className="cursor-pointer text-xs font-bold text-[var(--text)]"
                      style={{ pointerEvents: uploading ? "none" : "auto", opacity: uploading ? 0.5 : 1 }}
                    >
                      <span className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 hover:border-accent">
                        {uploading ? "Subiendo…" : s.img ? "Cambiar foto" : "Subir foto"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadService(file, i);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {s.img && (
                      <button
                        type="button"
                        className="btn-small-red"
                        onClick={() => clearServiceImage(i)}
                      >
                        Quitar foto
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-[15px] font-extrabold text-accent mt-1">Galería</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {draft.imgGaleria.map((src, i) => (
                <div
                  key={i}
                  className="relative rounded-xl overflow-hidden border border-[var(--border)] aspect-square"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Galería ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-lg bg-black/60 text-white text-sm font-bold hover:bg-red-600"
                    onClick={() => removeGaleriaImage(i)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <label
                className="grid place-items-center aspect-square rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-bold text-sm cursor-pointer hover:border-accent"
                style={{ pointerEvents: uploading ? "none" : "auto", opacity: uploading ? 0.5 : 1 }}
              >
                <span className="text-center px-3">{uploading ? "Subiendo…" : "+ Agregar foto"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) handleUploadGaleria(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {draft.imgGaleria.length === 0 && (
              <span className="text-[var(--muted)] text-[13px]">Sin fotos en la galería.</span>
            )}

            <h3 className="text-[15px] font-extrabold text-accent mt-1">Profesionales</h3>
            <p className="text-[var(--muted)] text-[13px]">
              Si dejás la foto vacía, se muestra una imagen de ejemplo por defecto.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {draft.profesionales.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2.5 bg-[var(--bg-soft)] border border-[var(--border)] rounded-xl p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {p.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.img}
                          alt={p.nombre || "Profesional"}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="grid w-12 h-12 rounded-lg place-items-center bg-[var(--card-2)] text-[var(--muted)]">
                          ✂
                        </span>
                      )}
                      <Field label="Fotografía">
                        <label className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              if (f) handleUploadProfesional(f, i);
                              e.target.value = "";
                            }}
                          />
                          <span className="px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] font-bold text-xs text-[var(--text)] cursor-pointer hover:border-accent">
                            {p.img ? "Cambiar" : "Subir"}
                          </span>
                        </label>
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="btn-small-red"
                      onClick={() => removeProfesional(i)}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
                    <Field label="Nombre">
                      <input
                        className="input"
                        value={p.nombre}
                        onChange={(e) => updateProfesional(i, "nombre", e.target.value)}
                      />
                    </Field>
                    <Field label="Rol">
                      <input
                        className="input"
                        value={p.rol}
                        onChange={(e) => updateProfesional(i, "rol", e.target.value)}
                      />
                    </Field>
                  </div>
                  <TagsEditor
                    tags={p.tags}
                    onChange={(tags) => updateProfesional(i, "tags", tags)}
                  />
                </div>
              ))}
              <button
                type="button"
                className="lg:col-span-2 justify-self-start px-4 py-2.5 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-sm text-[var(--text)] hover:border-[var(--accent)]"
                onClick={addProfesional}
              >
                + Agregar profesional
              </button>
            </div>

            {saved && (
              <p className="text-emerald-400 font-semibold">Imágenes guardadas ✓</p>
            )}

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 bg-[var(--card)]">
              <button
                type="button"
                disabled={saving || uploading}
                onClick={saveSettings as unknown as () => void}
                className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar imágenes"}
              </button>
              {sinGuardar && (
                <span className="text-[12.5px] font-bold text-amber-400">
                  ● Cambios sin guardar
                </span>
              )}
            </div>
          </div>
        )}
        <ConfirmDialog
          open={Boolean(bookingToDelete)}
          title="¿Anular este turno?"
          description="El turno quedará cancelado, liberará el horario y conservará su historial."
          detail={bookingToDelete ? `${bookingToDelete.name} · ${bookingToDelete.service} · ${formatDate(bookingToDelete.date)} · ${bookingToDelete.time} h` : undefined}
          confirmLabel="Anular turno"
          loading={deletingBooking}
          onConfirm={confirmRemoveBooking}
          onCancel={() => setBookingToDelete(null)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 font-semibold text-sm min-w-0 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState("");

  function addTag(raw: string) {
    const value = raw.trim().replace(/,+$/, "");
    if (!value) return;
    const cleaned = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    const next = Array.from(new Set([...tags, ...cleaned]));
    onChange(next);
    setText("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-semibold text-sm">Tags</span>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 bg-[var(--card-2)] border border-[var(--border)] px-2.5 py-1 rounded-full text-[13px]"
            >
              {t}
              <button
                type="button"
                className="text-[var(--muted)] text-[15px] leading-none p-0 hover:text-[var(--red)]"
                aria-label={`Quitar tag ${t}`}
                onClick={() => onChange(tags.filter((x) => x !== t))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="input"
          value={text}
          placeholder="Ej: Degradados, Barba"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(text);
            }
          }}
        />
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-sm text-[var(--text)] hover:border-[var(--accent)] shrink-0"
          onClick={() => addTag(text)}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  cls,
  onClick,
  active,
}: {
  label: string;
  cls: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const base = `text-[13px] font-bold px-3 py-1.5 rounded-full border bg-[var(--card)] whitespace-nowrap ${cls}`;
  if (!onClick) return <span className={base}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${active ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(212,168,83,0.10)]" : ""}`}
    >
      {label}
    </button>
  );
}

function SmallBtn({
  children,
  onClick,
  cls,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  cls: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 sm:px-2.5 sm:py-1.5 text-[12.5px] rounded-lg font-bold border ${cls} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ImageField({
  label,
  value,
  uploading,
  onChange,
  onClear,
  fit = "cover",
  aspect = "aspect-video",
  emptyLabel = "Sin imagen",
}: {
  label: string;
  value: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
  fit?: "cover" | "contain";
  aspect?: string;
  emptyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] p-3">
      <span className="font-semibold text-sm">{label}</span>
      {value ? (
        <div className={`relative rounded-lg overflow-hidden ${aspect} border border-[var(--border)] bg-[var(--card)]`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className={`w-full h-full ${fit === "contain" ? "object-contain p-2" : "object-cover"}`}
          />
        </div>
      ) : (
        <div className={`grid place-items-center rounded-lg ${aspect} border-2 border-dashed border-[var(--border)] text-[var(--muted)] text-xs font-semibold text-center px-2`}>
          {emptyLabel}
        </div>
      )}
      <div className="flex gap-2">
        <label
          className="flex-1 text-center px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-xs text-[var(--text)] cursor-pointer hover:border-accent"
          style={{ pointerEvents: uploading ? "none" : "auto", opacity: uploading ? 0.5 : 1 }}
        >
          {uploading ? "Subiendo…" : value ? "Cambiar" : "Subir"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) onChange(f);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--red)] hover:border-red-500/40"
            onClick={onClear}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

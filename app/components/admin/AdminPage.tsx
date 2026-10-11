"use client";

import { useEffect, useState } from "react";
import {
  adminDeleteBooking,
  adminGetBookings,
  adminGetSettings,
  adminUpdateBooking,
  adminUpdateSettings,
  adminUploadImage,
  AdminBooking,
  Settings,
} from "@/lib/client-api";
import { BarberPole } from "../booking/BarberIcons";
import Navbar from "../Navbar";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  done: "Completado",
};

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

export default function AdminPage({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const today = localDateStr(new Date());
  const [tab, setTab] = useState<"agenda" | "config" | "web" | "imagenes">(() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("adminTab");
      if (saved === "config" || saved === "web" || saved === "imagenes" || saved === "agenda") {
        return saved;
      }
    }
    return "agenda";
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [barberosInput, setBarberosInput] = useState("1");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    window.sessionStorage.setItem("adminTab", tab);
  }, [tab]);

  useEffect(() => {
    adminGetSettings(token)
      .then((s) => {
        setSettings(s);
        setDraft(JSON.parse(JSON.stringify(s)));
        setBarberosInput(String(s.cantidadBarberos ?? 1));
        setAdminEmail(s.adminEmail || "");
        setAdminPassword("");
      })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (tab !== "agenda") return;
    let cancelled = false;
    adminGetBookings(token, { date, status: status || undefined })
      .then((list) => {
        if (!cancelled) {
          setBookings(list);
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
  }, [token, tab, date, status]);

  async function changeStatus(id: string, newStatus: string) {
    setError("");
    try {
      await adminUpdateBooking(token, id, newStatus);
      const list = await adminGetBookings(token, { date, status: status || undefined });
      setBookings(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  async function removeBooking(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el turno de ${name}?`)) return;
    setError("");
    try {
      await adminDeleteBooking(token, id);
      const list = await adminGetBookings(token, { date, status: status || undefined });
      setBookings(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
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
      services: [...draft.services, { name: "", price: 0, duration: 30 }],
    });
  }

  function updateDay(index: number, field: string, value: string | boolean) {
    if (!draft) return;
    setDraft({
      ...draft,
      days: draft.days.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    });
  }

  function addBlockDate() {
    if (!draft || !newBlockDate) return;
    if (draft.unavailableDates.includes(newBlockDate)) return;
    setDraft({
      ...draft,
      unavailableDates: [...draft.unavailableDates, newBlockDate].sort(),
    });
    setNewBlockDate("");
  }

  async function handleUploadImage(
    file: File,
    key: "imgHero" | "imgAbout" | "imgReservar",
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
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    done: bookings.filter((b) => b.status === "done").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };
  const visibleBookings = bookings.filter((booking) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [booking.name, booking.phone, booking.service].some((value) =>
      value.toLowerCase().includes(query)
    );
  });

  return (
    <div className="booking-bg">
      <Navbar
        nombre={settings ? settings.barberName : "Barbería"}
        onLogout={onLogout}
      />
      <div className="flex flex-col gap-5 max-w-[720px] lg:max-w-5xl w-full mx-auto pt-24 px-5 pb-16">

        <BarberPole />

        <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
          <Tab active={tab === "agenda"} onClick={() => setTab("agenda")}>
            Agenda de turnos
          </Tab>
          <Tab active={tab === "config"} onClick={() => setTab("config")}>
            Configuración
          </Tab>
          <Tab active={tab === "web"} onClick={() => setTab("web")}>
            Sitio web
          </Tab>
          <Tab active={tab === "imagenes"} onClick={() => setTab("imagenes")}>
            Imágenes
          </Tab>
        </nav>

        {error && (
          <p className="text-[var(--red)] font-semibold bg-red-500/[0.08] border border-red-500/35 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        {tab === "agenda" && (
          <>
            <section className="flex flex-wrap items-end gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px]">
              <button
                type="button"
                className="px-4 py-3 rounded-xl bg-[var(--card-2)] border border-[var(--border)] font-bold text-sm hover:border-[var(--accent)]"
                onClick={() => setDate(today)}
              >
                Hoy
              </button>
              <Field label="Fecha">
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Estado">
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="confirmed">Confirmados</option>
                  <option value="done">Completados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </Field>
              <Field label="Buscar">
                <input
                  className="input min-w-[180px]"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, teléfono o servicio"
                  type="search"
                />
              </Field>
            </section>

            {status === "" && (
              <div className="flex flex-wrap gap-2">
                <Stat cls="text-accent border-accent/40" label={`${stats.pending} pendientes`} />
                <Stat cls="text-blue-400 border-blue-400/40" label={`${stats.confirmed} confirmados`} />
                <Stat cls="text-emerald-400 border-emerald-400/40" label={`${stats.done} completados`} />
                <Stat cls="text-[var(--muted)] border-[var(--muted)]/40" label={`${stats.cancelled} cancelados`} />
              </div>
            )}

            <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5">
              <h2 className="text-[17px] font-bold">
                {formatDate(date)}
                {status !== "" && (
                  <span className="text-[var(--muted)]"> · {STATUS_LABELS[status]}</span>
                )}
              </h2>
              {loading ? (
                <p className="text-[var(--muted)]">Cargando turnos…</p>
              ) : visibleBookings.length === 0 ? (
                <p className="text-[var(--muted)] bg-[var(--bg-soft)] border border-dashed border-[var(--border)] rounded-xl p-5 text-center">
                  No hay turnos para esta selección.
                </p>
              ) : (
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 list-none m-0 p-0">
                  {visibleBookings.map((b) => (
                    <li
                      key={b._id}
                      className={`grid grid-cols-[64px_1fr_auto] gap-3.5 items-start bg-[var(--bg-soft)] border border-[var(--border)] rounded-[14px] p-3.5 ${
                        b.status === "cancelled" ? "booking-cancelled" : ""
                      }`}
                    >
                      <div className="text-lg font-extrabold text-accent pt-0.5">
                        {b.time}
                      </div>
                      <div className="flex flex-col gap-[3px] min-w-0">
                        <div className="flex gap-2.5 items-center flex-wrap text-sm">
                          <strong>{b.name}</strong>
                          <span className={`st ${b.status}`}>{STATUS_LABELS[b.status]}</span>
                        </div>
                        <div className="flex gap-2.5 items-center flex-wrap text-sm text-[var(--muted)]">
                          <span>{b.service}</span>
                          <span>${Number(b.price || 0).toLocaleString("es-AR")}</span>
                        </div>
                        <div className="flex gap-2.5 items-center flex-wrap text-sm text-[var(--muted)]">
                          <span>{b.phone}</span>
                          <span>{b.duration} min</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end">
                        {b.status !== "cancelled" && b.status !== "done" && (
                          <>
                            {b.status !== "confirmed" && (
                              <SmallBtn
                                cls="bg-emerald-500/12 text-emerald-400 border-emerald-500/40"
                                onClick={() => changeStatus(b._id, "confirmed")}
                              >
                                Confirmar
                              </SmallBtn>
                            )}
                            {b.status !== "done" && (
                              <SmallBtn
                                cls="bg-blue-500/12 text-blue-400 border-blue-500/40"
                                onClick={() => changeStatus(b._id, "done")}
                              >
                                Completado
                              </SmallBtn>
                            )}
                          </>
                        )}
                        {b.status !== "cancelled" && b.status !== "done" && (
                          <SmallBtn
                            cls="bg-[var(--card-2)] text-[var(--muted)] border-[var(--border)]"
                            onClick={() => changeStatus(b._id, "cancelled")}
                          >
                            Cancelar
                          </SmallBtn>
                        )}
                        <SmallBtn
                          cls="bg-red-500/12 text-[var(--red)] border-red-500/40"
                          onClick={() => removeBooking(b._id, b.name)}
                        >
                          Eliminar
                        </SmallBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === "config" && draft && (
          <form className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5" onSubmit={saveSettings}>
            <h2 className="text-[17px] font-bold">Configuración</h2>

            <Field label="Nombre del local / barbería">
              <input
                className="input"
                value={draft.barberName}
                onChange={(e) => setDraft({ ...draft, barberName: e.target.value })}
              />
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
              El precio se muestra al cliente. La duración evita cruces de turnos.
            </p>
            <div className="flex flex-col gap-2.5">
              {draft.services.map((s, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_100px_100px_auto] gap-2">
                  <input
                    className="input col-span-2 sm:col-span-1"
                    value={s.name}
                    placeholder="Nombre del servicio"
                    onChange={(e) => updateDraftService(i, "name", e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={s.price}
                    onChange={(e) => updateDraftService(i, "price", e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min={5}
                    step={5}
                    value={s.duration}
                    onChange={(e) => updateDraftService(i, "duration", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-small-red"
                    onClick={() => removeService(i)}
                    disabled={draft.services.length <= 1}
                  >
                    Quitar
                  </button>
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
                min={10}
                step={10}
                className="input"
                value={draft.slotMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, slotMinutes: Number(e.target.value) })
                }
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
            <div className="flex gap-2.5 items-center">
              <input
                type="date"
                className="input"
                value={newBlockDate}
                min={today}
                onChange={(e) => setNewBlockDate(e.target.value)}
              />
              <button
                type="button"
                className="px-4 py-3 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406]"
                onClick={addBlockDate}
              >
                Bloquear día
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.unavailableDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-2 bg-[var(--card-2)] border border-[var(--border)] px-2.5 py-1.5 rounded-full text-[13px]"
                >
                  {formatDate(d)}
                  <button
                    type="button"
                    className="text-[var(--muted)] text-[15px] leading-none p-0 hover:text-[var(--red)]"
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
              ))}
              {draft.unavailableDates.length === 0 && (
                <span className="text-[var(--muted)] text-[13px]">Sin días bloqueados.</span>
              )}
            </div>

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

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </form>
        )}

        {tab === "web" && draft && (
          <form
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-3.5"
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

            {error && <p className="text-[var(--red)] font-semibold">{error}</p>}
            {saved && (
              <p className="text-emerald-400 font-semibold">
                Sitio web actualizado ✓
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar sitio web"}
            </button>
          </form>
        )}

        {tab === "imagenes" && draft && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-[22px] flex flex-col gap-5">
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

            <button
              type="button"
              disabled={saving || uploading}
              onClick={saveSettings as unknown as () => void}
              className="px-5 py-3.5 rounded-xl font-bold bg-gradient-to-b from-[var(--accent)] to-[var(--accent-strong)] text-[#1a1406] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar imágenes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-[15px] font-bold ${
        active
          ? "bg-accent/15 text-accent"
          : "bg-transparent text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
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

function Stat({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`text-[13px] font-bold px-3 py-1.5 rounded-full border bg-[var(--card)] ${cls}`}
    >
      {label}
    </span>
  );
}

function SmallBtn({
  children,
  onClick,
  cls,
}: {
  children: React.ReactNode;
  onClick: () => void;
  cls: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 text-[12.5px] rounded-lg font-bold border ${cls}`}
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
}: {
  label: string;
  value: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] p-3">
      <span className="font-semibold text-sm">{label}</span>
      {value ? (
        <div className="relative rounded-lg overflow-hidden aspect-video border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg aspect-video border-2 border-dashed border-[var(--border)] text-[var(--muted)] text-xs font-semibold">
          Sin imagen
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

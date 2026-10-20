import { Setting } from "./models/Setting";

/* ── Settings ─────────────────────────────── */

export function defaultSettings() {
  const days = Array.from({ length: 7 }, (_, day) => ({
    day,
    enabled: day !== 0,
    open: "09:00",
    close: "20:00",
  }));
  return {
    barberName: "Barbería Los Tilos",
    message: "Reservá tu turno online sin esperas.",
    slogan: "Tu estilo, nuestra pasión",
    heroTitle1: "Tu Estilo,",
    heroTitle2: "Nuestra Pasión",
    heroDescription:
      "Cortes modernos, degradados impecables y una experiencia premium que te hace volver.",
    aboutTitle: "Más que un corte,",
    aboutTitle2: "una experiencia",
    aboutText:
      "Combinamos técnica, estilo y calidez para que cada visita sea única. Nuestros profesionales están al día con las últimas tendencias en cortes y cuidado personal.",
    whatsapp: "5491162470117",
    instagram: "#",
    facebook: "#",
    email: "contacto@barberia.com",
    direccion: "Av. Ejemplo 1234, Ciudad",
    mapaQuery: "Av.+Ejemplo+1234,+Ciudad",
    mapLink: "https://maps.app.goo.gl/eYWFdpahSLpVakd68",
    imgHero: "",
    imgAbout: "",
    imgReservar: "",
    imgLogo: "",
    imgGaleria: [],
    profesionales: [],
    services: [
      { name: "Corte de cabello", price: 5000, duration: 30, img: "" },
      { name: "Barba", price: 3000, duration: 20, img: "" },
      { name: "Corte y barba", price: 7000, duration: 40, img: "" },
    ],
    days,
    slotMinutes: 30,
    cantidadBarberos: 1,
    pin: "",
    unavailableDates: [],
  };
}

/**
 * Deja el WhatsApp en formato internacional sin signos (ej. 5491162470117).
 * Si llega un número local argentino de 10 dígitos, agrega 54 9.
 */
export function normalizeWhatsapp(value: string): string {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10) digits = `549${digits}`;
  else if (digits.length === 12 && digits.startsWith("54")) {
    digits = `549${digits.slice(2)}`;
  }
  return digits;
}

export async function getSettings() {
  let doc = await Setting.findOne().select("+pin +pinHash");
  if (!doc) {
    doc = await Setting.create(defaultSettings());
  } else {
    const def = defaultSettings();
    const record = doc as unknown as Record<string, unknown>;
    for (const key of Object.keys(def)) {
      if (record[key] === undefined) {
        record[key] = def[key as keyof typeof def];
      }
    }
    const normalizedWhatsapp = normalizeWhatsapp(doc.whatsapp || "");
    if (normalizedWhatsapp && normalizedWhatsapp !== doc.whatsapp) {
      doc.whatsapp = normalizedWhatsapp;
    }
    await doc.save();
  }
  return doc;
}

/* ── Date/time helpers ────────────────────── */

export function normalizeDate(date: string): string | null {
  if (typeof date !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== +m[1] ||
    d.getUTCMonth() !== +m[2] - 1 ||
    d.getUTCDate() !== +m[3]
  ) {
    return null;
  }
  return date;
}

const BARBER_TIME_ZONE = process.env.BARBER_TIME_ZONE || "America/Argentina/Buenos_Aires";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BARBER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateStr(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localMinutes(date: Date): number {
  const parts = zonedParts(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function weekdayForDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const minutes = toMinutes(t);
  return minutes >= 0 && minutes < 24 * 60 && minutes % 1 === 0;
}

export function toTime(totalMinutes: number): string {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const m = String(totalMinutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function slotsBetween(open: string, close: string, step: number): string[] {
  const slots: string[] = [];
  const start = toMinutes(open);
  const end = toMinutes(close);
  for (let t = start; t < end; t += step) {
    slots.push(toTime(t));
  }
  return slots;
}

export function overlaps(
  startA: number,
  durA: number,
  startB: number,
  durB: number
): boolean {
  return startA < startB + durB && startB < startA + durA;
}

/* ── Auth ────────────────────────────────── */

export function checkToken(header: string | null): boolean {
  const value = header || "";
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const configuredToken = process.env.ADMIN_TOKEN?.trim();
  return Boolean(configuredToken && configuredToken.length >= 32 && token === configuredToken);
}

/* ── Types ────────────────────────────────── */

export type SlotResult = { time: string; free: boolean };

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
    whatsapp: "5491100000000",
    instagram: "#",
    facebook: "#",
    email: "contacto@barberia.com",
    direccion: "Av. Ejemplo 1234, Ciudad",
    mapaQuery: "Av.+Ejemplo+1234,+Ciudad",
    imgHero: "",
    imgAbout: "",
    imgReservar: "",
    imgGaleria: [],
    profesionales: [],
    services: [
      { name: "Corte de cabello", price: 5000, duration: 30, img: "" },
      { name: "Barba", price: 3000, duration: 20, img: "" },
      { name: "Corte y barba", price: 7000, duration: 40, img: "" },
    ],
    days,
    slotMinutes: 30,
    pin: "1234",
    unavailableDates: [],
  };
}

export async function getSettings() {
  let doc = await Setting.findOne();
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
    await doc.save();
  }
  return doc;
}

/* ── Date/time helpers ────────────────────── */

export function normalizeDate(date: string): string | null {
  if (typeof date !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== +m[1] ||
    d.getMonth() !== +m[2] - 1 ||
    d.getDate() !== +m[3]
  ) {
    return null;
  }
  return date;
}

export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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
  return token === (process.env.ADMIN_TOKEN || "turno-admin-token");
}

/* ── Types ────────────────────────────────── */

export type SlotResult = { time: string; free: boolean };

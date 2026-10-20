import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  normalizeDate,
  normalizeWhatsapp,
  defaultSettings,
} from "@/lib/booking-logic";
import { getAdminAccount, requireAdmin, setAdminCredentials } from "@/lib/auth";
import { Setting } from "@/lib/models/Setting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fillDefaults(doc: Record<string, unknown>) {
  const def = defaultSettings();
  for (const key of Object.keys(def)) {
    if (doc[key] === undefined) doc[key] = def[key as keyof typeof def];
  }
}

function normalizeMapLink(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    const isGoogleMapsUrl =
      url.hostname === "maps.app.goo.gl" ||
      url.hostname === "maps.google.com" ||
      (["www.google.com", "google.com"].includes(url.hostname) &&
        url.pathname.startsWith("/maps"));
    if (url.protocol !== "https:" || !isGoogleMapsUrl) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = await Setting.findOne();
    if (!doc) {
      doc = await Setting.create({
        barberName: "Barbería Los Tilos",
        message: "Reservá tu turno online sin esperas.",
        services: [
          { name: "Corte de cabello", price: 5000, duration: 30 },
          { name: "Barba", price: 3000, duration: 20 },
          { name: "Corte y barba", price: 7000, duration: 40 },
        ],
        days: Array.from({ length: 7 }, (_, day) => ({
          day,
          enabled: day !== 0,
          open: "09:00",
          close: "20:00",
        })),
        slotMinutes: 30,
        pin: "",
        unavailableDates: [],
      });
    } else {
      fillDefaults(doc);
      await doc.save();
    }
    return Response.json(await sanitizeSettings(doc));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    await connectDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = await Setting.findOne();
    if (!current) {
      current = await Setting.create({
        barberName: "Barbería Los Tilos",
        message: "Reservá tu turno online",
        services: [
          { name: "Corte de cabello", price: 5000, duration: 30 },
        ],
        days: Array.from({ length: 7 }, (_, day) => ({
          day,
          enabled: day !== 0,
          open: "09:00",
          close: "20:00",
        })),
        slotMinutes: 30,
        pin: "",
        unavailableDates: [],
      });
    } else {
      fillDefaults(current);
      await current.save();
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const strVal = (v: unknown, max: number, fallback?: string): string | null => {
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
      return fallback ?? null;
    };
    const setStr = (field: keyof typeof body, max: number) => {
      const val = strVal(body[field], max);
      if (val !== null) current[field] = val;
    };

    if (typeof body.barberName === "string") {
      current.barberName = body.barberName.trim().slice(0, 60);
    }
    if (typeof body.message === "string") {
      current.message = body.message.trim().slice(0, 200);
    }
    setStr("slogan", 60);
    setStr("heroTitle1", 60);
    setStr("heroTitle2", 60);
    setStr("heroDescription", 300);
    setStr("aboutTitle", 60);
    setStr("aboutTitle2", 60);
    setStr("aboutText", 600);
    if (typeof body.whatsapp === "string" && body.whatsapp.trim()) {
      const whatsapp = normalizeWhatsapp(body.whatsapp);
      if (whatsapp.length < 8 || whatsapp.length > 15) {
        return Response.json(
          { error: "Ingresá un WhatsApp válido con código de país." },
          { status: 400 }
        );
      }
      current.whatsapp = whatsapp;
    }
    setStr("instagram", 120);
    setStr("facebook", 120);
    setStr("email", 120);
    setStr("direccion", 200);
    setStr("mapaQuery", 500);
    if (typeof body.mapLink === "string") {
      const mapLink = normalizeMapLink(body.mapLink);
      if (mapLink === null) {
        return Response.json(
          { error: "Ingresá un enlace válido de Google Maps." },
          { status: 400 }
        );
      }
      current.mapLink = mapLink.slice(0, 500);
    }
    const applyScalarImg = (field: "imgHero" | "imgAbout" | "imgReservar" | "imgLogo") => {
      if (typeof current[field] === "undefined" || typeof current[field] !== "string") current[field] = "";
      if (typeof body[field] === "string") {
        current[field] = (body[field] as string).trim().slice(0, 500);
      }
    };
    applyScalarImg("imgHero");
    applyScalarImg("imgAbout");
    applyScalarImg("imgReservar");
    applyScalarImg("imgLogo");
    if (Array.isArray(body.imgGaleria)) {
      current.imgGaleria = body.imgGaleria
        .filter((x) => typeof x === "string" && x.trim())
        .slice(0, 24);
    }
    if (Array.isArray(body.profesionales)) {
      current.profesionales = body.profesionales
        .filter((p) => p && typeof p === "object")
        .map((p) => {
          const pr = p as Record<string, unknown>;
          return {
            nombre: typeof pr.nombre === "string" ? pr.nombre.trim().slice(0, 60) : "",
            rol: typeof pr.rol === "string" ? pr.rol.trim().slice(0, 60) : "",
            img: typeof pr.img === "string" ? pr.img.trim().slice(0, 500) : "",
            tags: Array.isArray(pr.tags)
              ? pr.tags.filter((t) => typeof t === "string").slice(0, 8)
              : [],
          };
        })
        .slice(0, 12);
    }
    if (Array.isArray(body.services)) {
      current.services = body.services
        .filter((s) => s && typeof s.name === "string" && s.name.trim())
        .map((s) => {
          const sv = s as Record<string, unknown>;
          return {
            name: (sv.name as string).trim().slice(0, 60),
            price: Number(sv.price) || 0,
            duration: Math.min(Math.max(Number(sv.duration) || 30, 5), 480),
            img: typeof sv.img === "string" ? sv.img.trim().slice(0, 500) : "",
          };
        });
    }
    if (Array.isArray(body.days) && body.days.length === 7) {
      current.days = body.days.map((d, i: number) => ({
        day: i,
        enabled: Boolean(d.enabled),
        open:
          typeof d.open === "string" && /^\d{2}:\d{2}$/.test(d.open)
            ? d.open
            : "09:00",
        close:
          typeof d.close === "string" && /^\d{2}:\d{2}$/.test(d.close)
            ? d.close
            : "20:00",
      }));
    }
    if (typeof body.slotMinutes === "number") {
      current.slotMinutes = Math.min(Math.max(Math.round(body.slotMinutes), 10), 120);
    }
    if (typeof body.cantidadBarberos === "number") {
      current.cantidadBarberos = Math.max(1, Math.round(body.cantidadBarberos));
    }
    const account = await getAdminAccount();
    const requestedEmail =
      typeof body.adminEmail === "string" && body.adminEmail.trim()
        ? body.adminEmail
        : account.email;
    const requestedPassword = typeof body.adminPassword === "string" ? body.adminPassword : "";
    if (Array.isArray(body.unavailableDates)) {
      current.unavailableDates = [
        ...new Set(body.unavailableDates.filter((x) => normalizeDate(x))),
      ];
    }

    await current.save();
    if (requestedEmail.trim() || requestedPassword) {
      await setAdminCredentials(requestedEmail, requestedPassword);
    }
    return Response.json(await sanitizeSettings(current));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

async function sanitizeSettings(doc: Record<string, unknown>) {
  const candidate = doc as unknown as { toObject?: () => Record<string, unknown> };
  const plain = typeof candidate.toObject === "function" ? candidate.toObject() : { ...doc };
  delete plain.pin;
  delete plain.pinHash;
  const account = await getAdminAccount();
  return { ...plain, adminEmail: account.email, adminPassword: "" };
}

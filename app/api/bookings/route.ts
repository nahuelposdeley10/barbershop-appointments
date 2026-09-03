import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getSettings,
  normalizeDate,
  localDateStr,
  toMinutes,
  overlaps,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: {
      name?: string;
      phone?: string;
      service?: string;
      date?: string;
      time?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const { name, phone, service, date, time } = body || {};
    if (!name || !phone || !service || !date || !time) {
      return Response.json({ error: "Completá todos los datos" }, { status: 400 });
    }
    const d = normalizeDate(date);
    if (!d) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return Response.json({ error: "Hora inválida" }, { status: 400 });
    }

    await connectDB();
    const settings = await getSettings();
    const serviceCfg = settings.services.find((s) => s.name === service);
    if (!serviceCfg) {
      return Response.json({ error: "Servicio inválido" }, { status: 400 });
    }

    const today = localDateStr(new Date());
    if (d < today) {
      return Response.json(
        { error: "No se puede reservar para una fecha pasada" },
        { status: 400 }
      );
    }

    const weekday = new Date(`${d}T00:00:00`).getDay();
    const dayCfg = settings.days.find((x) => x.day === weekday);
    if (!dayCfg || !dayCfg.enabled) {
      return Response.json({ error: "Ese día no se atiende" }, { status: 400 });
    }
    if (settings.unavailableDates.includes(d)) {
      return Response.json({ error: "Ese día está bloqueado" }, { status: 400 });
    }

    const start = toMinutes(time);
    const end = start + serviceCfg.duration;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (d === today && start <= nowMinutes) {
      return Response.json(
        { error: "Ese horario ya pasó, elegí uno posterior" },
        { status: 400 }
      );
    }
    if (start < toMinutes(dayCfg.open) || end > toMinutes(dayCfg.close)) {
      return Response.json(
        { error: "Hora fuera del horario de atención" },
        { status: 400 }
      );
    }

    const openings = await Booking.find({ date: d, status: { $ne: "cancelled" } });
    const conflict = openings.find((b) =>
      overlaps(start, serviceCfg.duration, toMinutes(b.time), b.duration)
    );
    if (conflict) {
      return Response.json(
        { error: "Ese horario acaba de ser ocupado, elegí otro." },
        { status: 409 }
      );
    }

    const booking = await Booking.create({
      name: name.trim(),
      phone: phone.trim(),
      service,
      duration: serviceCfg.duration,
      price: serviceCfg.price,
      date: d,
      time,
      status: "pending",
    });
    return Response.json(booking, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

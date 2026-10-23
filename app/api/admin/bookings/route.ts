import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getSettings,
  isValidTime,
  normalizeDate,
  localDateStr,
  localMinutes,
  toMinutes,
  weekdayForDate,
  overlaps,
  normalizeWhatsapp,
} from "@/lib/booking-logic";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";
import { tenantFilter } from "@/lib/tenancy";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const context = await getAdminContext(req);
    if (!context) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    if (context.role === "superadmin") {
      return Response.json({ error: "El superadmin debe elegir una barbería desde su sección." }, { status: 403 });
    }

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

    const cleanName = typeof body.name === "string" ? body.name.trim() : "";
    const cleanPhone = typeof body.phone === "string" ? normalizeWhatsapp(body.phone) : "";
    const cleanService = typeof body.service === "string" ? body.service.trim() : "";
    const cleanDate = typeof body.date === "string" ? normalizeDate(body.date) : null;
    const cleanTime = typeof body.time === "string" ? body.time.trim() : "";

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return Response.json({ error: "El nombre debe tener entre 2 y 80 caracteres" }, { status: 400 });
    }
    if (cleanPhone && (cleanPhone.length < 8 || cleanPhone.length > 15)) {
      return Response.json({ error: "Ingresá un teléfono válido o dejá el campo vacío" }, { status: 400 });
    }
    if (!cleanDate) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (!isValidTime(cleanTime)) {
      return Response.json({ error: "Hora inválida" }, { status: 400 });
    }

    await connectDB();
    const settings = await getSettings(context.tenantId);
    const service = settings.services.find((item) => item.name === cleanService);
    if (!service) {
      return Response.json({ error: "Elegí un servicio válido" }, { status: 400 });
    }

    const today = localDateStr(new Date());
    if (cleanDate > today) {
      return Response.json({ error: "Un turno completado no puede quedar en una fecha futura" }, { status: 400 });
    }
    const dayCfg = settings.days.find((day) => day.day === weekdayForDate(cleanDate));
    const start = toMinutes(cleanTime);
    const end = start + service.duration;
    if (cleanDate === today) {
      if (!dayCfg?.enabled || settings.unavailableDates.includes(cleanDate)) {
        return Response.json({ error: "Ese día no figura como disponible" }, { status: 400 });
      }
      if (start > localMinutes(new Date())) {
        return Response.json({ error: "Un turno completado debe tener una hora ya realizada" }, { status: 400 });
      }
    }
    if (dayCfg?.enabled && (start < toMinutes(dayCfg.open) || end > toMinutes(dayCfg.close))) {
      return Response.json({ error: "El turno queda fuera del horario de atención" }, { status: 400 });
    }
    if (cleanDate === today) {
      const openings = await Booking.find({
        ...tenantFilter(context.tenantId),
        date: cleanDate,
        status: { $ne: "cancelled" },
      }).select("time duration").lean();
      const occupied = openings.filter((booking) =>
        overlaps(start, service.duration, toMinutes(booking.time), booking.duration)
      ).length;
      if (occupied >= Math.max(1, settings.cantidadBarberos || 1)) {
        return Response.json({ error: "Ese horario ya está completo" }, { status: 409 });
      }
    }

    const booking = await Booking.create({
      name: cleanName,
      phone: cleanPhone,
      service: service.name,
      duration: service.duration,
      price: service.price,
      date: cleanDate,
      time: cleanTime,
      status: "done",
      paymentStatus: "paid",
      ...tenantFilter(context.tenantId),
    });
    void recordAuditLog({
      tenantId: context.tenantId,
      actorId: context.userId,
      action: "booking.manual_created",
      entityType: "booking",
      entityId: String(booking._id),
      metadata: { date: cleanDate, time: cleanTime, service: service.name },
    });

    return Response.json(booking, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAdminContext(req);
    if (!context) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    if (context.role === "superadmin") {
      return Response.json({ error: "El superadmin debe elegir una barbería desde su sección." }, { status: 403 });
    }
    await connectDB();
    const search = req.nextUrl.searchParams;
    const filter: Record<string, string> = { ...tenantFilter(context.tenantId) };
    const date = search.get("date");
    const status = search.get("status");
    if (date) {
      const d = normalizeDate(date);
      if (!d) return Response.json({ error: "Fecha inválida" }, { status: 400 });
      filter.date = d;
    }
    if (status && ["confirmed", "cancelled", "done"].includes(status)) {
      filter.status = status;
    }
    const bookings = await Booking.find(filter)
      .sort({ date: 1, time: 1 })
      .lean();
    return Response.json(bookings);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

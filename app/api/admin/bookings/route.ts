import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings, isValidTime, normalizeDate } from "@/lib/booking-logic";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";
import { tenantFilter } from "@/lib/tenancy";

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
    const cleanPhone = typeof body.phone === "string" ? body.phone.replace(/[^\d]/g, "") : "";
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

    const booking = await Booking.create({
      name: cleanName,
      phone: cleanPhone,
      service: service.name,
      duration: service.duration,
      price: service.price,
      date: cleanDate,
      time: cleanTime,
      status: "done",
      ...tenantFilter(context.tenantId),
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
      .select("+adminNote")
      .sort({ date: 1, time: 1 })
      .lean();
    return Response.json(bookings);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

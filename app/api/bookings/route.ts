import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getSettings,
  isValidTime,
  normalizeDate,
  normalizeWhatsapp,
  localDateStr,
  localMinutes,
  toMinutes,
  toTime,
  weekdayForDate,
  overlaps,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";
import { BookingLock } from "@/lib/models/BookingLock";
import { rateLimited } from "@/lib/rate-limit";
import { createBookingManageToken } from "@/lib/booking-access";
import { logRequestError, requestId, withRequestId } from "@/lib/request-id";
import { resolveTenantForRequest, tenantFilter } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = requestId(req);
  try {
    if (rateLimited(req, "create-booking", 12, 60 * 60 * 1000)) {
      return Response.json(
        { error: "Alcanzaste el límite de intentos. Probá nuevamente más tarde." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
    let body: {
      name?: string;
      phone?: string;
      service?: string;
      date?: string;
      time?: string;
      website?: string;
    } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    if (body.website) {
      return Response.json({ error: "Solicitud inválida" }, { status: 400 });
    }
    const { name, phone, service, date, time } = body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanPhone = typeof phone === "string" ? normalizeWhatsapp(phone) : "";
    const cleanService = typeof service === "string" ? service.trim() : "";
    const cleanTime = typeof time === "string" ? time.trim() : "";
    if (!cleanName || !cleanPhone || !cleanService || !date || !cleanTime) {
      return Response.json({ error: "Completá todos los datos" }, { status: 400 });
    }
    if (cleanName.length < 2 || cleanName.length > 80) {
      return Response.json({ error: "El nombre debe tener entre 2 y 80 caracteres" }, { status: 400 });
    }
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      return Response.json({ error: "Ingresá un teléfono válido" }, { status: 400 });
    }
    const d = normalizeDate(date);
    if (!d) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }
    if (!isValidTime(cleanTime)) {
      return Response.json({ error: "Hora inválida" }, { status: 400 });
    }

    await connectDB();
    const { tenant, explicit } = await resolveTenantForRequest(req);
    if (explicit && !tenant) {
      return Response.json({ error: "Barbería no encontrada" }, { status: 404 });
    }
    const tenantId = tenant ? String(tenant._id) : undefined;
    const settings = await getSettings(tenantId);
    const serviceCfg = settings.services.find((s) => s.name === cleanService);
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

    const weekday = weekdayForDate(d);
    const dayCfg = settings.days.find((x) => x.day === weekday);
    if (!dayCfg || !dayCfg.enabled) {
      return Response.json({ error: "Ese día no se atiende" }, { status: 400 });
    }
    if (settings.unavailableDates.includes(d)) {
      return Response.json({ error: "Ese día está bloqueado" }, { status: 400 });
    }

    const start = toMinutes(cleanTime);
    const end = start + serviceCfg.duration;
    const now = new Date();
    const nowMinutes = localMinutes(now);
    if (d === today && start <= nowMinutes) {
      return Response.json(
        { error: "Ese horario ya pasó, elegí uno posterior" },
        { status: 400 }
      );
    }
    if (start < toMinutes(dayCfg.open)) {
      return Response.json(
        { error: `El local abre a las ${dayCfg.open}, elegí un horario posterior` },
        { status: 400 }
      );
    }
    if (end > toMinutes(dayCfg.close)) {
      return Response.json(
        {
          error: `El turno termina ${toTime(end)} y el local cierra a las ${dayCfg.close}. Elegí un horario más temprano.`,
        },
        { status: 400 }
      );
    }

    const manageToken = createBookingManageToken();
    const session = await mongoose.startSession();
    let booking: unknown;
    try {
      await session.withTransaction(async () => {
        // Serializa las reservas del mismo día para evitar sobreventa por carreras concurrentes.
        await BookingLock.findOneAndUpdate(
          { ...tenantFilter(tenantId), date: d },
          { $setOnInsert: { ...(tenantId ? { tenantId } : {}), date: d } },
          { upsert: true, new: true, session }
        );
        const openings = await Booking.find({ ...tenantFilter(tenantId), date: d, status: { $ne: "cancelled" } })
          .select("time duration")
          .session(session)
          .lean();
        const sillas = Math.max(1, settings.cantidadBarberos || 1);
        const ocupadas = openings.filter((b) =>
          overlaps(start, serviceCfg.duration, toMinutes(b.time), b.duration)
        ).length;
        if (ocupadas >= sillas) {
          throw new BookingConflictError();
        }

        const created = await Booking.create(
          [{
            name: cleanName,
            phone: cleanPhone,
            service: cleanService,
            duration: serviceCfg.duration,
            price: serviceCfg.price,
            date: d,
            time: cleanTime,
            status: "confirmed",
            paymentStatus: "pending",
            ...(tenantId ? { tenantId } : {}),
            manageTokenHash: manageToken.hash,
          }],
          { session }
        );
        booking = created[0].toObject();
      });
    } catch (err) {
      if (err instanceof BookingConflictError) {
        return Response.json(
          { error: "Ese horario está lleno en todas las sillas, elegí otro." },
          { status: 409 }
        );
      }
      throw err;
    } finally {
      await session.endSession();
    }
    const publicBooking = { ...(booking as Record<string, unknown>) };
    delete publicBooking.manageTokenHash;
    return Response.json(
      {
        ...publicBooking,
        manageToken: manageToken.token,
        address: settings.direccion,
      },
      { status: 201 }
    );
  } catch (err) {
    logRequestError("create-booking", id, err);
    return withRequestId(Response.json({ error: "Error del servidor", requestId: id }, { status: 500 }), id);
  }
}

class BookingConflictError extends Error {}

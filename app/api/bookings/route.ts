import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { after, NextRequest } from "next/server";
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
import { createBookingManageToken, hashBookingPassword } from "@/lib/booking-access";
import { logRequestError, requestId, withRequestId } from "@/lib/request-id";
import { resolveTenantForRequest, tenantFilter } from "@/lib/tenancy";
import { sendBookingCreatedEmail } from "@/lib/booking-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCustomerName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");
}

function customerLockKey(name: string, phone: string, service: string) {
  const identity = `${normalizeCustomerName(name)}\u0000${phone}\u0000${service.normalize("NFKC").toLocaleLowerCase("es-AR")}`;
  return `customer:${createHash("sha256").update(identity).digest("hex")}`;
}

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
      managePassword?: string;
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
    const { name, phone, service, date, time, managePassword } = body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanPhone = typeof phone === "string" ? normalizeWhatsapp(phone) : "";
    const cleanService = typeof service === "string" ? service.trim() : "";
    const cleanTime = typeof time === "string" ? time.trim() : "";
    const cleanManagePassword = typeof managePassword === "string" ? managePassword : "";
    if (!cleanName || !cleanPhone || !cleanService || !date || !cleanTime) {
      return Response.json({ error: "Completá todos los datos" }, { status: 400 });
    }
    if (cleanName.length < 2 || cleanName.length > 80) {
      return Response.json({ error: "El nombre debe tener entre 2 y 80 caracteres" }, { status: 400 });
    }
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      return Response.json({ error: "Ingresá un teléfono válido" }, { status: 400 });
    }
    if (cleanManagePassword.length < 6 || cleanManagePassword.length > 72) {
      return Response.json(
        { error: "La contraseña del turno debe tener entre 6 y 72 caracteres" },
        { status: 400 }
      );
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
    if (!explicit || !tenant) {
      return Response.json({ error: "Barbería no encontrada" }, { status: 404 });
    }
    const tenantId = String(tenant._id);
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
    const duplicateLock = customerLockKey(cleanName, cleanPhone, cleanService);
    const session = await mongoose.startSession();
    let booking: unknown;
    try {
      await session.withTransaction(async () => {
        // Serializa intentos del mismo cliente para impedir duplicados incluso
        // si llegan dos solicitudes simultáneas o desde dispositivos distintos.
        await BookingLock.findOneAndUpdate(
          { ...tenantFilter(tenantId), date: duplicateLock },
          { $setOnInsert: { tenantId, date: duplicateLock } },
          { upsert: true, new: true, session }
        );

        // Serializa las reservas del mismo día para evitar sobreventa por carreras concurrentes.
        await BookingLock.findOneAndUpdate(
          { ...tenantFilter(tenantId), date: d },
          { $setOnInsert: { tenantId, date: d } },
          { upsert: true, new: true, session }
        );

        const normalizedName = normalizeCustomerName(cleanName);
        const possibleDuplicates = await Booking.find({
          ...tenantFilter(tenantId),
          phone: cleanPhone,
          service: cleanService,
          status: "confirmed",
          date: { $gte: today },
        })
          .select("name date time duration")
          .session(session)
          .lean();
        const hasActiveDuplicate = possibleDuplicates.some((item) => {
          if (normalizeCustomerName(item.name) !== normalizedName) return false;
          if (item.date > today) return true;
          if (!isValidTime(item.time)) return true;
          return toMinutes(item.time) + Math.max(0, item.duration || 0) > nowMinutes;
        });
        if (hasActiveDuplicate) {
          throw new BookingDuplicateError();
        }

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
            managePasswordHash: hashBookingPassword(cleanManagePassword),
          }],
          { session }
        );
        booking = created[0].toObject();
      });
    } catch (err) {
      if (err instanceof BookingDuplicateError) {
        return Response.json(
          { error: "Ya tenés una reserva activa para este servicio. No podés reservar otra hasta completar o cancelar la actual." },
          { status: 409 }
        );
      }
      if (err instanceof BookingConflictError) {
        return Response.json(
          { error: "Ese horario está lleno en todas las sillas, elegí otro." },
          { status: 409 }
        );
      }
      throw err;
    } finally {
      await session.endSession();
      try {
        await BookingLock.deleteOne({ ...tenantFilter(tenantId), date: duplicateLock });
      } catch (cleanupError) {
        logRequestError("cleanup-customer-booking-lock", id, cleanupError);
      }
    }
    const publicBooking = { ...(booking as Record<string, unknown>) };
    delete publicBooking.manageTokenHash;
    delete publicBooking.managePasswordHash;
    if (settings.bookingEmailNotificationsEnabled && settings.bookingNotificationEmail) {
      after(async () => {
        await sendBookingCreatedEmail({
          bookingId: String(publicBooking._id || ""),
          recipient: settings.bookingNotificationEmail,
          barberName: settings.barberName,
          customerName: cleanName,
          customerPhone: cleanPhone,
          service: serviceCfg.name,
          date: d,
          time: cleanTime,
          duration: serviceCfg.duration,
          price: serviceCfg.price,
        });
      });
    }
    return Response.json(
      {
        ...publicBooking,
        manageToken: manageToken.token,
        managePasswordRequired: true,
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
class BookingDuplicateError extends Error {}

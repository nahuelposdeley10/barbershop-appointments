import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { hashBookingManageToken, verifyBookingPassword } from "@/lib/booking-access";
import {
  getSettings,
  isValidTime,
  localDateStr,
  localMinutes,
  normalizeDate,
  overlaps,
  toMinutes,
  weekdayForDate,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";
import { BookingLock } from "@/lib/models/BookingLock";
import mongoose from "mongoose";
import { rateLimited } from "@/lib/rate-limit";
import { tenantFilter } from "@/lib/tenancy";
import { normalizeWhatsapp } from "@/lib/booking-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

function validToken(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}

function validBookingId(value: string) {
  return mongoose.isValidObjectId(value);
}

function bookingFilter(identifier: string) {
  if (validToken(identifier)) return { manageTokenHash: hashBookingManageToken(identifier) };
  if (validBookingId(identifier)) return { _id: identifier };
  return null;
}

function canManageBooking(
  booking: { managePasswordHash?: string; phone?: string },
  identifier: string,
  password?: string,
  phone?: string
) {
  if (!booking.managePasswordHash) return validToken(identifier);
  if (!password || !verifyBookingPassword(password, booking.managePasswordHash)) return false;
  if (validToken(identifier)) return true;
  return !phone || normalizeWhatsapp(phone) === booking.phone;
}

function publicBooking(booking: { toObject: () => Record<string, unknown> }) {
  const result = booking.toObject();
  delete result.manageTokenHash;
  delete result.managePasswordHash;
  return result;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  if (!validToken(token)) return Response.json({ error: "Link inválido" }, { status: 400 });
  await connectDB();
  const booking = await Booking.findOne({ manageTokenHash: hashBookingManageToken(token) });
  if (!booking) return Response.json({ error: "Turno no encontrado" }, { status: 404 });
  return Response.json(booking);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const filter = bookingFilter(token);
  if (!filter) return Response.json({ error: "Link inválido" }, { status: 400 });
  if (rateLimited(_req, "cancel-booking", 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Demasiados intentos. Probá nuevamente más tarde." }, { status: 429 });
  }
  let body: { password?: string; phone?: string } = {};
  try {
    body = await _req.json();
  } catch {
    // Las reservas antiguas se siguen pudiendo gestionar con su token local.
  }
  await connectDB();
  const booking = await Booking.findOne(filter).select("+managePasswordHash");
  if (!booking) return Response.json({ error: "Turno no encontrado" }, { status: 404 });
  if (!canManageBooking(booking, token, body.password, body.phone)) {
    return Response.json({ error: "La contraseña del turno es incorrecta" }, { status: 401 });
  }
  if (booking.status === "cancelled") return Response.json(publicBooking(booking));
  if (booking.status === "done") {
    return Response.json({ error: "Este turno ya fue completado" }, { status: 409 });
  }
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();
  return Response.json(publicBooking(booking));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const filter = bookingFilter(token);
  if (!filter) return Response.json({ error: "Link inválido" }, { status: 400 });
  if (rateLimited(req, "edit-booking", 20, 60 * 60 * 1000)) {
    return Response.json({ error: "Demasiados intentos. Probá nuevamente más tarde." }, { status: 429 });
  }

  let body: { service?: string; date?: string; time?: string; password?: string; phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const serviceName = typeof body.service === "string" ? body.service.trim() : "";
  const date = normalizeDate(typeof body.date === "string" ? body.date : "");
  const time = typeof body.time === "string" ? body.time.trim() : "";
  if (!serviceName || !date || !isValidTime(time)) {
    return Response.json({ error: "Servicio, fecha u hora inválidos" }, { status: 400 });
  }

  await connectDB();
  const currentBooking = await Booking.findOne(filter).select("tenantId phone +managePasswordHash");
  if (!currentBooking) return Response.json({ error: "Turno no encontrado" }, { status: 404 });
  if (!canManageBooking(currentBooking, token, body.password, body.phone)) {
    return Response.json({ error: "La contraseña del turno es incorrecta" }, { status: 401 });
  }
  if (!currentBooking.tenantId) return Response.json({ error: "Turno no encontrado" }, { status: 404 });
  const tenantId = String(currentBooking.tenantId);
  const settings = await getSettings(tenantId);
  const service = settings.services.find((item) => item.name === serviceName);
  if (!service) return Response.json({ error: "Servicio inválido" }, { status: 400 });

  const today = localDateStr(new Date());
  const weekday = weekdayForDate(date);
  const dayCfg = settings.days.find((item) => item.day === weekday);
  const start = toMinutes(time);
  const end = start + service.duration;
  if (date < today) return Response.json({ error: "No se puede elegir una fecha pasada" }, { status: 400 });
  if (!dayCfg || !dayCfg.enabled) return Response.json({ error: "Ese día no se atiende" }, { status: 400 });
  if (settings.unavailableDates.includes(date)) return Response.json({ error: "Ese día está bloqueado" }, { status: 400 });
  if (date === today && start <= localMinutes(new Date())) {
    return Response.json({ error: "Ese horario ya pasó, elegí otro" }, { status: 400 });
  }
  if (start < toMinutes(dayCfg.open) || end > toMinutes(dayCfg.close)) {
    return Response.json({ error: "Hora fuera del horario de atención" }, { status: 400 });
  }

  const session = await mongoose.startSession();
  try {
    let updated: Record<string, unknown> = {};
    let hasUpdated = false;
    await session.withTransaction(async () => {
      const booking = await Booking.findOne(filter).select("+managePasswordHash").session(session);
      if (!booking) throw new BookingManageError("not-found");
      if (!canManageBooking(booking, token, body.password, body.phone)) throw new BookingManageError("unauthorized");
      if (booking.status === "cancelled") throw new BookingManageError("cancelled");
      if (booking.status === "done") throw new BookingManageError("done");

      const lockDates = [...new Set([booking.date, date])].sort();
      for (const lockDate of lockDates) {
        await BookingLock.findOneAndUpdate(
          { ...tenantFilter(tenantId), date: lockDate },
          { $setOnInsert: { tenantId, date: lockDate } },
          { upsert: true, new: true, session }
        );
      }
      const openings = await Booking.find({
        ...tenantFilter(tenantId),
        date,
        status: { $ne: "cancelled" },
        _id: { $ne: booking._id },
      }).session(session);
      const capacity = Math.max(1, settings.cantidadBarberos || 1);
      const occupied = openings.filter((item) =>
        overlaps(start, service.duration, toMinutes(item.time), item.duration)
      ).length;
      if (occupied >= capacity) throw new BookingManageError("conflict");

      booking.service = service.name;
      booking.duration = service.duration;
      booking.price = service.price;
      booking.date = date;
      booking.time = time;
      await booking.save({ session });
      updated = booking.toObject();
      hasUpdated = true;
    });
    if (!hasUpdated) throw new Error("No se pudo actualizar el turno");
    delete updated.manageTokenHash;
    delete updated.managePasswordHash;
    return Response.json(updated);
  } catch (error) {
    if (error instanceof BookingManageError) {
      if (error.reason === "not-found") return Response.json({ error: "Turno no encontrado" }, { status: 404 });
      if (error.reason === "unauthorized") return Response.json({ error: "La contraseña del turno es incorrecta" }, { status: 401 });
      if (error.reason === "cancelled") return Response.json({ error: "El turno ya está cancelado" }, { status: 409 });
      if (error.reason === "done") return Response.json({ error: "Este turno ya fue completado" }, { status: 409 });
      if (error.reason === "conflict") return Response.json({ error: "Ese horario ya no está disponible" }, { status: 409 });
    }
    console.error(error);
    return Response.json({ error: "No pudimos actualizar el turno" }, { status: 500 });
  } finally {
    await session.endSession();
  }
}

class BookingManageError extends Error {
  constructor(public reason: "not-found" | "cancelled" | "done" | "conflict" | "unauthorized") {
    super(reason);
  }
}

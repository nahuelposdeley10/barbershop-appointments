import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getSettings,
  normalizeDate,
  localDateStr,
  localMinutes,
  toMinutes,
  slotsBetween,
  overlaps,
  weekdayForDate,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";
import { rateLimited } from "@/lib/rate-limit";
import { logRequestError, requestId, withRequestId } from "@/lib/request-id";
import { resolveTenantForRequest, tenantFilter } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = requestId(req);
  try {
    if (rateLimited(req, "availability", 120, 60 * 1000)) {
      return Response.json({ error: "Demasiadas consultas. Intentá nuevamente." }, { status: 429 });
    }
    await connectDB();
    const { tenant, explicit } = await resolveTenantForRequest(req);
    if (explicit && !tenant) {
      return Response.json({ error: "Barbería no encontrada" }, { status: 404 });
    }
    const tenantId = tenant ? String(tenant._id) : undefined;
    const search = req.nextUrl.searchParams;
    const date = normalizeDate(search.get("date") || "");
    if (!date) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const settings = await getSettings(tenantId);
    const today = localDateStr(new Date());
    const weekday = weekdayForDate(date);
    const dayCfg = settings.days.find((x) => x.day === weekday);
    const isUnavailable = settings.unavailableDates.includes(date);
    const canAttend = !isUnavailable && dayCfg && dayCfg.enabled && date >= today;

    let slots: { time: string; free: boolean; ocupadas: number; sillas: number }[] = [];
    if (canAttend) {
      const serviceName = search.get("service") || "";
      const service = settings.services.find((s) => s.name === serviceName);
      const duration = service ? service.duration : settings.slotMinutes;
      const sillas = Math.max(1, settings.cantidadBarberos || 1);
      const openings = await Booking.find({ ...tenantFilter(tenantId), date, status: { $ne: "cancelled" } })
        .select("time duration")
        .lean();
      const now = new Date();
      const nowMinutes = localMinutes(now);
      const isToday = date === today;
      const closeMinutes = toMinutes(dayCfg.close);
      // Un turno tiene que terminar antes del cierre: los horarios que se pasan
      // del horario de atención no se ofrecen (el POST los rechazaría).
      slots = slotsBetween(dayCfg.open, dayCfg.close, settings.slotMinutes)
        .filter((time) => toMinutes(time) + duration <= closeMinutes)
        .map((time) => {
          const start = toMinutes(time);
          const past = isToday && start <= nowMinutes;
          const ocupadas = openings.filter((b) =>
            overlaps(start, duration, toMinutes(b.time), b.duration)
          ).length;
          const free = !past && ocupadas < sillas;
          return { time, free, ocupadas, sillas };
        });
    }

    return Response.json({
      barberName: settings.barberName,
      message: settings.message,
      imgLogo: settings.imgLogo || "",
      services: settings.services,
      date,
      slots,
      whatsappRemindersEnabled: Boolean(settings.whatsappRemindersEnabled),
    });
  } catch (err) {
    logRequestError("availability", id, err);
    return withRequestId(Response.json({ error: "Error del servidor", requestId: id }, { status: 500 }), id);
  }
}

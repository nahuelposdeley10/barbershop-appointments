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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (rateLimited(req, "availability", 120, 60 * 1000)) {
      return Response.json({ error: "Demasiadas consultas. Intentá nuevamente." }, { status: 429 });
    }
    await connectDB();
    const search = req.nextUrl.searchParams;
    const date = normalizeDate(search.get("date") || "");
    if (!date) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const settings = await getSettings();
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
      const openings = await Booking.find({ date, status: { $ne: "cancelled" } });
      const now = new Date();
      const nowMinutes = localMinutes(now);
      const isToday = date === today;
      slots = slotsBetween(dayCfg.open, dayCfg.close, settings.slotMinutes).map(
        (time) => {
          const start = toMinutes(time);
          const past = isToday && start <= nowMinutes;
          const ocupadas = openings.filter((b) =>
            overlaps(start, duration, toMinutes(b.time), b.duration)
          ).length;
          const free = !past && ocupadas < sillas;
          return { time, free, ocupadas, sillas };
        }
      );
    }

    return Response.json({
      barberName: settings.barberName,
      message: settings.message,
      imgLogo: settings.imgLogo || "",
      services: settings.services,
      date,
      slots,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

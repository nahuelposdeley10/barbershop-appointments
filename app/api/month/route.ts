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
  addDays,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (rateLimited(req, "month-availability", 60, 60 * 1000)) {
      return Response.json({ error: "Demasiadas consultas. Intentá nuevamente." }, { status: 429 });
    }
    await connectDB();
    const search = req.nextUrl.searchParams;
    const from = normalizeDate(search.get("from") || "");
    if (!from) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const settings = await getSettings();
    const serviceName = search.get("service") || "";
    const service = settings.services.find((s) => s.name === serviceName);
    const duration = service ? service.duration : settings.slotMinutes;
    const today = localDateStr(new Date());

    const to = addDays(from, 41);

    const openings = await Booking.find({
      date: { $gte: from, $lte: to },
      status: { $ne: "cancelled" },
    });
    const byDate: Record<
      string,
      Array<{ time: string; duration: number }>
    > = {};
    for (const b of openings) {
      (byDate[b.date] ||= []).push({ time: b.time, duration: b.duration });
    }

    const days: { date: string; status: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = addDays(from, i);
      let status: string;
      if (date < today) {
        status = "past";
      } else {
        const weekday = weekdayForDate(date);
        const dayCfg = settings.days.find((x) => x.day === weekday);
        const blocked = settings.unavailableDates.includes(date);
        if (!dayCfg || !dayCfg.enabled || blocked) {
          status = "closed";
        } else {
          const now = new Date();
          const nowMinutes = localMinutes(now);
          const isToday = date === today;
          if (isToday && nowMinutes >= toMinutes(dayCfg.close)) {
            status = "closed";
          } else {
            const sillas = Math.max(1, settings.cantidadBarberos || 1);
            const dayBookings = byDate[date] || [];
            const free = slotsBetween(
              dayCfg.open,
              dayCfg.close,
              settings.slotMinutes
            ).some((time) => {
              const start = toMinutes(time);
              if (isToday && start <= nowMinutes) return false;
              const ocupadas = dayBookings.filter((b) =>
                overlaps(start, duration, toMinutes(b.time), b.duration)
              ).length;
              return ocupadas < sillas;
            });
            status = free ? "free" : "full";
          }
        }
      }
      days.push({ date, status });
    }

    return Response.json({ days });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

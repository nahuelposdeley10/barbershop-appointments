import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getSettings,
  normalizeDate,
  localDateStr,
  toMinutes,
  slotsBetween,
  overlaps,
} from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
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

    const toDate = new Date(`${from}T00:00:00`);
    toDate.setDate(toDate.getDate() + 41);
    const to = localDateStr(toDate);

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
    const cursor = new Date(`${from}T00:00:00`);
    for (let i = 0; i < 42; i++) {
      const date = localDateStr(cursor);
      let status: string;
      if (date < today) {
        status = "past";
      } else {
        const weekday = cursor.getDay();
        const dayCfg = settings.days.find((x) => x.day === weekday);
        const blocked = settings.unavailableDates.includes(date);
        if (!dayCfg || !dayCfg.enabled || blocked) {
          status = "closed";
        } else {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const isToday = date === today;
          if (isToday && nowMinutes >= toMinutes(dayCfg.close)) {
            status = "closed";
          } else {
            const dayBookings = byDate[date] || [];
            const free = slotsBetween(
              dayCfg.open,
              dayCfg.close,
              settings.slotMinutes
            ).some((time) => {
              const start = toMinutes(time);
              if (isToday && start <= nowMinutes) return false;
              return !dayBookings.some((b) =>
                overlaps(start, duration, toMinutes(b.time), b.duration)
              );
            });
            status = free ? "free" : "full";
          }
        }
      }
      days.push({ date, status });
      cursor.setDate(cursor.getDate() + 1);
    }

    return Response.json({ days });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

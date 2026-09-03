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
    const date = normalizeDate(search.get("date") || "");
    if (!date) {
      return Response.json({ error: "Fecha inválida" }, { status: 400 });
    }

    const settings = await getSettings();
    const today = localDateStr(new Date());
    const weekday = new Date(`${date}T00:00:00`).getDay();
    const dayCfg = settings.days.find((x) => x.day === weekday);
    const isUnavailable = settings.unavailableDates.includes(date);
    const canAttend = !isUnavailable && dayCfg && dayCfg.enabled && date >= today;

    let slots: { time: string; free: boolean }[] = [];
    if (canAttend) {
      const serviceName = search.get("service") || "";
      const service = settings.services.find((s) => s.name === serviceName);
      const duration = service ? service.duration : settings.slotMinutes;
      const openings = await Booking.find({ date, status: { $ne: "cancelled" } });
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const isToday = date === today;
      slots = slotsBetween(dayCfg.open, dayCfg.close, settings.slotMinutes).map(
        (time) => {
          const start = toMinutes(time);
          const past = isToday && start <= nowMinutes;
          const free = !past && !openings.some((b) =>
            overlaps(start, duration, toMinutes(b.time), b.duration)
          );
          return { time, free };
        }
      );
    }

    return Response.json({
      barberName: settings.barberName,
      message: settings.message,
      services: settings.services,
      date,
      slots,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

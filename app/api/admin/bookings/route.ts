import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizeDate } from "@/lib/booking-logic";
import { requireAdmin } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    await connectDB();
    const search = req.nextUrl.searchParams;
    const filter: Record<string, string> = {};
    const date = search.get("date");
    const status = search.get("status");
    if (date) {
      const d = normalizeDate(date);
      if (!d) return Response.json({ error: "Fecha inválida" }, { status: 400 });
      filter.date = d;
    }
    if (status && ["pending", "confirmed", "cancelled", "done"].includes(status)) {
      filter.status = status;
    }
    const bookings = await Booking.find(filter).sort({ date: 1, time: 1 });
    return Response.json(bookings);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

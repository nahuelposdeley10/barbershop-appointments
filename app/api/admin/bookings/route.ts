import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizeDate } from "@/lib/booking-logic";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";
import { tenantFilter } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

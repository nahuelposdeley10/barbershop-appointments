import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyBookingPassword } from "@/lib/booking-access";
import { Booking } from "@/lib/models/Booking";
import { rateLimited } from "@/lib/rate-limit";
import { resolveTenantForRequest, tenantFilter } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (rateLimited(req, "find-managed-bookings", 10, 60 * 60 * 1000)) {
    return Response.json(
      { error: "Demasiados intentos. Probá nuevamente más tarde." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 6 || password.length > 72) {
    return Response.json({ error: "Ingresá la contraseña del turno" }, { status: 400 });
  }

  await connectDB();
  const { tenant, explicit } = await resolveTenantForRequest(req);
  if (!explicit || !tenant) {
    return Response.json({ error: "Barbería no encontrada" }, { status: 404 });
  }

  const candidates = await Booking.find({
    ...tenantFilter(String(tenant._id)),
    status: "confirmed",
    managePasswordHash: { $exists: true },
  })
    .select("+managePasswordHash")
    .sort({ date: 1, time: 1 })
    .lean();

  const matches = candidates.filter(
    (booking) => booking.managePasswordHash && verifyBookingPassword(password, booking.managePasswordHash)
  );

  if (matches.length === 0) {
    return Response.json({ error: "No encontramos turnos con esos datos" }, { status: 401 });
  }

  return Response.json(
    matches.map((booking) => {
      const result = { ...booking, manageId: String(booking._id), managePasswordRequired: true };
      delete result.manageTokenHash;
      delete result.managePasswordHash;
      return result;
    })
  );
}

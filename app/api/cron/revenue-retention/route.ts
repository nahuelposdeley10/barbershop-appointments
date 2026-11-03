import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { localDateStr } from "@/lib/booking-logic";
import { Tenant } from "@/lib/models/Tenant";
import { archiveAndPruneTenant, bookingRetentionCutoff } from "@/lib/revenue-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await connectDB();
    const today = localDateStr(new Date());
    const before = bookingRetentionCutoff(today);
    const tenants = await Tenant.find({ status: "active" }).select("_id").lean();
    const summary = {
      before,
      tenants: tenants.length,
      deletedBookings: 0,
      archivedBookings: 0,
      archivedAmount: 0,
    };

    for (const tenant of tenants) {
      const result = await archiveAndPruneTenant(String(tenant._id), before);
      summary.deletedBookings += result.deletedBookings;
      summary.archivedBookings += result.archivedBookings;
      summary.archivedAmount += result.archivedAmount;
    }

    return Response.json({ ok: true, ...summary });
  } catch (error) {
    console.error("revenue-retention", error);
    return Response.json({ error: "No se pudo completar la limpieza histórica" }, { status: 500 });
  }
}

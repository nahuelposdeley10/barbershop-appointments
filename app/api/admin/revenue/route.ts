import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { localDateStr } from "@/lib/booking-logic";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevenueRange = { from: string; to: string };

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getRanges(today: string): Record<"today" | "week" | "month", RevenueRange> {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (todayDate.getUTCDay() + 6) % 7;
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    today: { from: today, to: today },
    week: { from: shiftDate(today, -daysSinceMonday), to: today },
    month: { from: monthStart, to: today },
  };
}

async function summarize(range: RevenueRange, tenantId: string | null) {
  const tenantFilter = tenantId
    ? { tenantId: new mongoose.Types.ObjectId(tenantId) }
    : { tenantId: { $exists: false } };
  const rows = await Booking.aggregate([
    {
      $match: {
        ...tenantFilter,
        date: { $gte: range.from, $lte: range.to },
        status: { $in: ["confirmed", "done"] },
      },
    },
    {
      $group: {
        _id: "$status",
        amount: { $sum: { $ifNull: ["$price", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const confirmed = rows.find((row) => row._id === "confirmed");
  const done = rows.find((row) => row._id === "done");
  const pending = Number(confirmed?.amount || 0);
  const collected = Number(done?.amount || 0);
  return {
    ...range,
    total: pending + collected,
    collected,
    pending,
    appointmentCount: Number(confirmed?.count || 0) + Number(done?.count || 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const context = await getAdminContext(req);
    if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
    if (context.role === "superadmin") {
      return Response.json({ error: "El superadmin debe elegir una barbería desde su sección." }, { status: 403 });
    }
    await connectDB();
    const today = localDateStr(new Date());
    const ranges = getRanges(today);
    return Response.json({
      asOf: today,
      today: await summarize(ranges.today, context.tenantId),
      week: await summarize(ranges.week, context.tenantId),
      month: await summarize(ranges.month, context.tenantId),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "No pudimos cargar los ingresos" }, { status: 500 });
  }
}

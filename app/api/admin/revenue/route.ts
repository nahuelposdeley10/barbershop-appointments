import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { localDateStr } from "@/lib/booking-logic";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RevenueRange = { from?: string; to?: string };

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getOffset(value: string | null) {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 4);
}

function getRanges(today: string, dayOffset: number, weekOffset: number, monthOffset: number): Record<"today" | "week" | "month" | "global", RevenueRange> {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (todayDate.getUTCDay() + 6) % 7;
  const selectedDay = shiftDate(today, -dayOffset);
  const currentWeekStart = shiftDate(today, -daysSinceMonday);
  const weekStart = shiftDate(currentWeekStart, -weekOffset * 7);
  const weekEnd = weekOffset === 0 ? today : shiftDate(weekStart, 6);

  const targetMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - monthOffset, 1));
  const monthStart = targetMonth.toISOString().slice(0, 10);
  const monthEnd = monthOffset === 0
    ? today
    : new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

  return {
    today: { from: selectedDay, to: selectedDay },
    week: { from: weekStart, to: weekEnd },
    month: { from: monthStart, to: monthEnd },
    global: { from: "", to: today },
  };
}

async function summarize(range: RevenueRange, tenantId: string | null) {
  const tenantFilter = tenantId
    ? { tenantId: new mongoose.Types.ObjectId(tenantId) }
    : { tenantId: { $exists: false } };
  const dateFilter = range.from || range.to
    ? { date: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) } }
    : {};
  const rows = await Booking.aggregate([
    {
      $match: {
        ...tenantFilter,
        ...dateFilter,
        status: { $in: ["confirmed", "done"] },
      },
    },
    {
      $group: {
        _id: {
          $cond: [
            {
              $or: [
                { $eq: ["$paymentStatus", "paid"] },
                {
                  $and: [
                    { $eq: ["$status", "done"] },
                    { $ne: ["$paymentStatus", "refunded"] },
                  ],
                },
              ],
            },
            "collected",
            "pending",
          ],
        },
        amount: { $sum: { $ifNull: ["$price", 0] } },
        count: { $sum: 1 },
      },
    },
  ]);

  const confirmed = rows.find((row) => row._id === "pending");
  const done = rows.find((row) => row._id === "collected");
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
    const ranges = getRanges(
      today,
      getOffset(req.nextUrl.searchParams.get("dayOffset")),
      getOffset(req.nextUrl.searchParams.get("weekOffset")),
      getOffset(req.nextUrl.searchParams.get("monthOffset"))
    );
    return Response.json({
      asOf: today,
      today: await summarize(ranges.today, context.tenantId),
      week: await summarize(ranges.week, context.tenantId),
      month: await summarize(ranges.month, context.tenantId),
      global: await summarize(ranges.global, context.tenantId),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "No pudimos cargar los ingresos" }, { status: 500 });
  }
}

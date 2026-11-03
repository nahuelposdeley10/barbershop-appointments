import mongoose from "mongoose";
import { localDateStr } from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";
import { RevenueArchive } from "@/lib/models/RevenueArchive";

export const BOOKING_RETENTION_MONTHS = 12;

export function bookingRetentionCutoff(today = localDateStr(new Date())) {
  const value = new Date(`${today}T00:00:00Z`);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - BOOKING_RETENTION_MONTHS, 1))
    .toISOString()
    .slice(0, 10);
}

type ArchiveRow = {
  _id: { period: string; bucket: "collected" | "pending" };
  amount: number;
  count: number;
};

export async function archiveAndPruneTenant(tenantId: string, before: string) {
  const session = await mongoose.startSession();
  let result = { deletedBookings: 0, archivedBookings: 0, archivedAmount: 0 };
  try {
    await session.withTransaction(async () => {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      const rows = await Booking.aggregate<ArchiveRow>([
        {
          $match: {
            tenantId: tenantObjectId,
            date: { $lt: before },
            status: { $in: ["confirmed", "done"] },
          },
        },
        {
          $group: {
            _id: {
              period: { $substrBytes: ["$date", 0, 7] },
              bucket: {
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
            },
            amount: { $sum: { $ifNull: ["$price", 0] } },
            count: { $sum: 1 },
          },
        },
      ]).session(session);

      let archivedBookings = 0;
      let archivedAmount = 0;
      for (const row of rows) {
        const amount = Number(row.amount || 0);
        const count = Number(row.count || 0);
        await RevenueArchive.updateOne(
          { tenantId, period: row._id.period },
          {
            $setOnInsert: { tenantId, period: row._id.period },
            $inc: {
              total: amount,
              collected: row._id.bucket === "collected" ? amount : 0,
              pending: row._id.bucket === "pending" ? amount : 0,
              appointmentCount: count,
              sourceBookings: count,
            },
          },
          { upsert: true, session }
        );
        archivedBookings += count;
        archivedAmount += amount;
      }

      const deleted = await Booking.deleteMany(
        { tenantId, date: { $lt: before } },
        { session }
      );
      result = {
        deletedBookings: deleted.deletedCount || 0,
        archivedBookings,
        archivedAmount,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

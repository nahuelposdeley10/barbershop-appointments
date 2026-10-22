import mongoose from "mongoose";

const bookingLockSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    date: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

bookingLockSchema.index({ tenantId: 1, date: 1 }, { unique: true });

export const BookingLock =
  (mongoose.models.BookingLock as mongoose.Model<{ date: string }>) ||
  mongoose.model("BookingLock", bookingLockSchema);

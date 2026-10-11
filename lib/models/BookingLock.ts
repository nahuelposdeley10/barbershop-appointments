import mongoose from "mongoose";

const bookingLockSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export const BookingLock =
  (mongoose.models.BookingLock as mongoose.Model<{ date: string }>) ||
  mongoose.model("BookingLock", bookingLockSchema);

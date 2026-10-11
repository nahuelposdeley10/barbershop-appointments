import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    service: { type: String, required: true },
    duration: { type: Number, required: true },
    price: { type: Number, default: 0 },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "done"],
      default: "pending",
    },
    manageTokenHash: { type: String, select: false, index: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

bookingSchema.index({ date: 1, time: 1, status: 1 });

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "done";

export type BookingDoc = {
  _id: string;
  name: string;
  phone: string;
  service: string;
  duration: number;
  price: number;
  date: string;
  time: string;
  status: BookingStatus;
  manageTokenHash?: string;
  cancelledAt?: Date;
};

// Reuse the model if already compiled (avoids errors on hot-reload)
export const Booking =
  (mongoose.models.Booking as mongoose.Model<BookingDoc>) ||
  mongoose.model("Booking", bookingSchema);

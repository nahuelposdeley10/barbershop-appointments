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
  },
  { timestamps: true }
);

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
};

// Reutilizar modelo si ya está compilado (evita errores en hot-reload)
export const Booking =
  (mongoose.models.Booking as mongoose.Model<BookingDoc>) ||
  mongoose.model("Booking", bookingSchema);

import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    service: { type: String, required: true },
    duration: { type: Number, required: true },
    price: { type: Number, default: 0 },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "done"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
      index: true,
    },
    manageTokenHash: { type: String, select: false, index: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "", maxlength: 300 },
    whatsappOptIn: { type: Boolean, default: false },
    whatsappReminderStatus: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    whatsappReminderClaimedAt: { type: Date },
    whatsappReminderSentAt: { type: Date },
    whatsappReminderMessageId: { type: String, default: "" },
    whatsappReminderError: { type: String, default: "" },
  },
  { timestamps: true }
);

bookingSchema.index({ tenantId: 1, date: 1, time: 1, status: 1 });

export type BookingStatus = "confirmed" | "cancelled" | "done";
export type PaymentStatus = "pending" | "paid" | "refunded";

export type BookingDoc = {
  _id: string;
  tenantId?: string;
  name: string;
  phone: string;
  service: string;
  duration: number;
  price: number;
  date: string;
  time: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  manageTokenHash?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  whatsappOptIn?: boolean;
  whatsappReminderStatus?: "pending" | "processing" | "sent" | "failed" | "skipped";
  whatsappReminderClaimedAt?: Date;
  whatsappReminderSentAt?: Date;
  whatsappReminderMessageId?: string;
  whatsappReminderError?: string;
};

// Reuse the model if already compiled (avoids errors on hot-reload)
export const Booking =
  (mongoose.models.Booking as mongoose.Model<BookingDoc>) ||
  mongoose.model("Booking", bookingSchema);

import mongoose from "mongoose";

const revenueArchiveSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    period: { type: String, required: true },
    total: { type: Number, default: 0 },
    collected: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    appointmentCount: { type: Number, default: 0 },
    sourceBookings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

revenueArchiveSchema.index({ tenantId: 1, period: 1 }, { unique: true });

export type RevenueArchiveDoc = {
  _id: string;
  tenantId: string;
  period: string;
  total: number;
  collected: number;
  pending: number;
  appointmentCount: number;
  sourceBookings: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export const RevenueArchive =
  (mongoose.models.RevenueArchive as mongoose.Model<RevenueArchiveDoc>) ||
  mongoose.model("RevenueArchive", revenueArchiveSchema);

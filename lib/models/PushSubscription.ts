import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 2048,
    },
    keys: {
      p256dh: { type: String, required: true, maxlength: 512 },
      auth: { type: String, required: true, maxlength: 256 },
    },
    expirationTime: { type: Date, default: null },
    enabled: { type: Boolean, default: true, index: true },
    lastSuccessAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ tenantId: 1, enabled: 1, updatedAt: -1 });

export type PushSubscriptionDoc = {
  _id: string;
  tenantId: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: Date | null;
  enabled: boolean;
  lastSuccessAt?: Date | null;
  failureCount: number;
};

export const PushSubscriptionModel =
  (mongoose.models.PushSubscription as mongoose.Model<PushSubscriptionDoc>) ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);

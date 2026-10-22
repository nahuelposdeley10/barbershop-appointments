import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
  },
  { timestamps: true }
);

export type TenantDoc = {
  _id: string;
  slug: string;
  name: string;
  ownerId: string;
  status: "active" | "suspended";
};

export const Tenant =
  (mongoose.models.Tenant as mongoose.Model<TenantDoc>) ||
  mongoose.model("Tenant", tenantSchema);

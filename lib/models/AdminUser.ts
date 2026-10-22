import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["superadmin", "owner"], default: "owner", index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
  },
  { timestamps: true }
);

export type AdminUserDoc = {
  email: string;
  passwordHash: string;
  role: "superadmin" | "owner";
  tenantId?: string | null;
};

export const AdminUser =
  (mongoose.models.AdminUser as mongoose.Model<AdminUserDoc>) ||
  mongoose.model("AdminUser", adminUserSchema);

import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

export type AdminUserDoc = {
  email: string;
  passwordHash: string;
};

export const AdminUser =
  (mongoose.models.AdminUser as mongoose.Model<AdminUserDoc>) ||
  mongoose.model("AdminUser", adminUserSchema);

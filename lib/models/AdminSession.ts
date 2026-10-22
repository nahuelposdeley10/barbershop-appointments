import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: false, index: true },
    impersonatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: false, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export type AdminSessionDoc = {
  _id: string;
  tokenHash: string;
  userId?: string;
  impersonatedBy?: string;
  expiresAt: Date;
};

export const AdminSession =
  (mongoose.models.AdminSession as mongoose.Model<AdminSessionDoc>) ||
  mongoose.model("AdminSession", adminSessionSchema);

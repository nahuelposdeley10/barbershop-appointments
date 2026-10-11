import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export type AdminSessionDoc = {
  _id: string;
  tokenHash: string;
  expiresAt: Date;
};

export const AdminSession =
  (mongoose.models.AdminSession as mongoose.Model<AdminSessionDoc>) ||
  mongoose.model("AdminSession", adminSessionSchema);

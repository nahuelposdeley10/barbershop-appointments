import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    action: { type: String, required: true, maxlength: 80 },
    entityType: { type: String, required: true, maxlength: 40 },
    entityId: { type: String, required: false, maxlength: 80 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<Record<string, unknown>>) ||
  mongoose.model("AuditLog", auditLogSchema);

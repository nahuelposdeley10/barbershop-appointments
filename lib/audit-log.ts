import { connectDB } from "@/lib/db";
import { AuditLog } from "@/lib/models/AuditLog";

export async function recordAuditLog(input: {
  tenantId?: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await connectDB();
    await AuditLog.create({
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      actorId: input.actorId,
      action: input.action.slice(0, 80),
      entityType: input.entityType.slice(0, 40),
      ...(input.entityId ? { entityId: input.entityId.slice(0, 80) } : {}),
      metadata: input.metadata || {},
    });
  } catch (error) {
    console.error("Audit log unavailable", error);
  }
}

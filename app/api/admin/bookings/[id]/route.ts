import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";
import { tenantFilter } from "@/lib/tenancy";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUS = ["confirmed", "cancelled", "done"] as const;
const PAYMENT_STATUS = ["pending", "paid", "refunded"] as const;

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const context = await getAdminContext(req);
    if (!context) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    if (context.role === "superadmin") return Response.json({ error: "Acción no disponible para superadmin" }, { status: 403 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }
    let body: { status?: string; paymentStatus?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const { status, paymentStatus } = body || {};
    if (status !== undefined && (typeof status !== "string" || !STATUS.includes(status as typeof STATUS[number]))) {
      return Response.json({ error: "Estado inválido" }, { status: 400 });
    }
    if (paymentStatus !== undefined && (typeof paymentStatus !== "string" || !PAYMENT_STATUS.includes(paymentStatus as typeof PAYMENT_STATUS[number]))) {
      return Response.json({ error: "Estado de pago inválido" }, { status: 400 });
    }
    if (status === undefined && paymentStatus === undefined) {
      return Response.json({ error: "No hay cambios para guardar" }, { status: 400 });
    }
    await connectDB();
    const current = await Booking.findOne({ _id: id, ...tenantFilter(context.tenantId) }).select("status").lean();
    if (!current) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    const transitions: Record<string, string[]> = {
      confirmed: ["cancelled", "done"],
      cancelled: [],
      done: [],
    };
    if (status !== undefined && status !== current.status && !transitions[current.status]?.includes(status)) {
      return Response.json({ error: "Ese cambio de estado no está permitido" }, { status: 409 });
    }
    const update: { status?: string; paymentStatus?: string; cancelledAt?: Date; cancelledBy?: string } = {};
    if (status !== undefined) update.status = status;
    if (paymentStatus !== undefined) update.paymentStatus = paymentStatus;
    if (status === "cancelled" && current.status !== "cancelled") {
      update.cancelledAt = new Date();
      update.cancelledBy = context.userId;
    }
    const booking = await Booking.findOneAndUpdate(
      { _id: id, ...tenantFilter(context.tenantId) },
      update,
      { new: true }
    );
    if (!booking) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    void recordAuditLog({
      tenantId: context.tenantId,
      actorId: context.userId,
      action: "booking.updated",
      entityType: "booking",
      entityId: id,
      metadata: { status, paymentStatus },
    });
    return Response.json(booking);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const context = await getAdminContext(req);
    if (!context) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    if (context.role === "superadmin") return Response.json({ error: "Acción no disponible para superadmin" }, { status: 403 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }
    await connectDB();
    const current = await Booking.findOne({ _id: id, ...tenantFilter(context.tenantId) }).select("status").lean();
    if (!current) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (current.status === "done") {
      return Response.json({ error: "Un turno completado no se puede anular" }, { status: 409 });
    }
    const booking = await Booking.findOneAndUpdate(
      { _id: id, status: "confirmed", ...tenantFilter(context.tenantId) },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: context.userId,
          cancelReason: "Cancelado desde el panel",
        },
      },
      { new: true }
    );
    if (!booking) {
      return Response.json({ error: "El turno ya no está activo" }, { status: 409 });
    }
    void recordAuditLog({
      tenantId: context.tenantId,
      actorId: context.userId,
      action: "booking.cancelled",
      entityType: "booking",
      entityId: id,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

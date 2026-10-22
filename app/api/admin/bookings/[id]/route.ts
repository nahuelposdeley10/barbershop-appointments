import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getAdminContext } from "@/lib/auth";
import { Booking } from "@/lib/models/Booking";
import { tenantFilter } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUS = ["confirmed", "cancelled", "done"];

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
    let body: { status?: string; adminNote?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const { status, adminNote } = body || {};
    if (status !== undefined && (typeof status !== "string" || !STATUS.includes(status))) {
      return Response.json({ error: "Estado inválido" }, { status: 400 });
    }
    if (adminNote !== undefined && (typeof adminNote !== "string" || adminNote.length > 500)) {
      return Response.json({ error: "La nota no puede superar los 500 caracteres" }, { status: 400 });
    }
    if (status === undefined && adminNote === undefined) {
      return Response.json({ error: "No hay cambios para guardar" }, { status: 400 });
    }
    await connectDB();
    const update: { status?: string; adminNote?: string } = {};
    if (status !== undefined) update.status = status;
    if (adminNote !== undefined) update.adminNote = adminNote.trim();
    const booking = await Booking.findOneAndUpdate(
      { _id: id, ...tenantFilter(context.tenantId) },
      update,
      { new: true }
    ).select("+adminNote");
    if (!booking) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
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
    const booking = await Booking.findOneAndDelete({ _id: id, ...tenantFilter(context.tenantId) });
    if (!booking) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

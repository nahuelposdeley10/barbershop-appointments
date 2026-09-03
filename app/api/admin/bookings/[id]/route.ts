import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { checkToken } from "@/lib/booking-logic";
import { Booking } from "@/lib/models/Booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const STATUS = ["pending", "confirmed", "cancelled", "done"];

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    if (!checkToken(req.headers.get("authorization"))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }
    let body: { status?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const { status } = body || {};
    if (typeof status !== "string" || !STATUS.includes(status)) {
      return Response.json({ error: "Estado inválido" }, { status: 400 });
    }
    await connectDB();
    const booking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
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
    if (!checkToken(req.headers.get("authorization"))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "ID inválido" }, { status: 400 });
    }
    await connectDB();
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) {
      return Response.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

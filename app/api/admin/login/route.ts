import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/lib/booking-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: { pin?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    await connectDB();
    const settings = await getSettings();
    const { pin } = body || {};
    if (pin === settings.pin) {
      return Response.json({
        token: process.env.ADMIN_TOKEN || "turno-admin-token",
      });
    }
    return Response.json({ error: "PIN incorrecto" }, { status: 401 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

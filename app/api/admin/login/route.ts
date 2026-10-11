import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  clearLoginFailures,
  createAdminSession,
  isLoginRateLimited,
  recordLoginFailure,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (isLoginRateLimited(req)) {
      return Response.json(
        { error: "Demasiados intentos. Esperá unos minutos e intentá nuevamente." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }
    let body: { email?: string; password?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
    }
    const { email, password } = body || {};
    await connectDB();
    if (await verifyAdminCredentials(email || "", password || "")) {
      clearLoginFailures(req);
      const response = NextResponse.json({ authenticated: true });
      setAdminSessionCookie(response, await createAdminSession());
      return response;
    }
    recordLoginFailure(req);
    return Response.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error del servidor" }, { status: 500 });
  }
}

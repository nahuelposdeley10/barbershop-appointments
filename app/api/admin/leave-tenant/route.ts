import { NextRequest, NextResponse } from "next/server";
import { getAdminContext, restoreImpersonatorSession, setAdminSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!context.isImpersonating) {
    return Response.json({ error: "No hay una barbería abierta" }, { status: 400 });
  }

  const token = await restoreImpersonatorSession(req);
  if (!token) return Response.json({ error: "La sesión central ya no está disponible" }, { status: 401 });

  const response = NextResponse.json({
    authenticated: true,
    role: "superadmin",
    tenantId: null,
    tenantName: null,
    tenantSlug: null,
    isImpersonating: false,
  });
  setAdminSessionCookie(response, token);
  return response;
}

import { NextRequest } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { sendTestPush } from "@/lib/booking-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!context.tenantId) {
    return Response.json({ error: "No hay una barbería seleccionada" }, { status: 403 });
  }

  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 2048) {
    return Response.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const result = await sendTestPush({ tenantId: context.tenantId, endpoint });
  if (!result.configured) {
    return Response.json({ error: "Las notificaciones todavía no están configuradas" }, { status: 503 });
  }
  if (result.sent === 0) {
    return Response.json(
      { error: "No pudimos enviar la prueba. Volvé a activar este dispositivo." },
      { status: 410 }
    );
  }
  return Response.json({ ok: true });
}

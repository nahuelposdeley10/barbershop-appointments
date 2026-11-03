import { NextRequest } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PushSubscriptionModel } from "@/lib/models/PushSubscription";
import { pushIsConfigured } from "@/lib/booking-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionBody = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function parseSubscription(body: SubscriptionBody) {
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";
  if (!endpoint || endpoint.length > 2048 || !p256dh || p256dh.length > 512 || !auth || auth.length > 256) {
    return null;
  }
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }

  const expirationTime =
    typeof body.expirationTime === "number" && Number.isFinite(body.expirationTime)
      ? new Date(body.expirationTime)
      : null;
  return { endpoint, keys: { p256dh, auth }, expirationTime };
}

async function tenantContext(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return { error: Response.json({ error: "No autorizado" }, { status: 401 }) };
  if (!context.tenantId) {
    return { error: Response.json({ error: "No hay una barbería seleccionada" }, { status: 403 }) };
  }
  return { context };
}

export async function GET(req: NextRequest) {
  const resolved = await tenantContext(req);
  if (resolved.error || !resolved.context) return resolved.error;
  await connectDB();
  const subscriptionCount = await PushSubscriptionModel.countDocuments({
    tenantId: resolved.context.tenantId,
    enabled: true,
  });
  return Response.json({
    configured: pushIsConfigured(),
    publicKey: pushIsConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : "",
    subscriptionCount,
  });
}

export async function POST(req: NextRequest) {
  const resolved = await tenantContext(req);
  if (resolved.error || !resolved.context) return resolved.error;
  if (!pushIsConfigured()) {
    return Response.json({ error: "Las notificaciones todavía no están configuradas" }, { status: 503 });
  }

  let body: SubscriptionBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const subscription = parseSubscription(body);
  if (!subscription) {
    return Response.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  await connectDB();
  const userId = resolved.context.actorUserId || resolved.context.userId;
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        tenantId: resolved.context.tenantId,
        userId,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime,
        enabled: true,
        failureCount: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const resolved = await tenantContext(req);
  if (resolved.error || !resolved.context) return resolved.error;
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

  await connectDB();
  await PushSubscriptionModel.deleteOne({
    tenantId: resolved.context.tenantId,
    endpoint,
  });
  return Response.json({ ok: true });
}

import webPush, { type PushSubscription as WebPushSubscription } from "web-push";
import { connectDB } from "@/lib/db";
import { PushSubscriptionModel } from "@/lib/models/PushSubscription";

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type PushDeliveryResult = {
  sent: number;
  failed: number;
  removed: number;
  configured: boolean;
};

let configuredKey = "";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "";
  if (!publicKey || !privateKey || !subject) return false;

  const key = `${subject}:${publicKey}`;
  if (configuredKey !== key) {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    configuredKey = key;
  }
  return true;
}

function webPushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: Date | null;
}): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    expirationTime: subscription.expirationTime?.getTime() ?? null,
  };
}

async function deliverToSubscriptions(
  subscriptions: Array<{
    _id: unknown;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: Date | null;
    failureCount?: number;
  }>,
  payload: PushPayload
): Promise<PushDeliveryResult> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, removed: 0, configured: false };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const subscriptionId = String(subscription._id);
      try {
        await webPush.sendNotification(
          webPushSubscription(subscription),
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" }
        );
        sent += 1;
        await PushSubscriptionModel.updateOne(
          { _id: subscriptionId },
          { $set: { lastSuccessAt: new Date(), failureCount: 0, enabled: true } }
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          removed += 1;
          await PushSubscriptionModel.deleteOne({ _id: subscriptionId });
          return;
        }

        failed += 1;
        const nextFailureCount = (subscription.failureCount || 0) + 1;
        await PushSubscriptionModel.updateOne(
          { _id: subscriptionId },
          {
            $set: {
              failureCount: nextFailureCount,
              ...(nextFailureCount >= 3 ? { enabled: false } : {}),
            },
          }
        );
      }
    })
  );

  return { sent, failed, removed, configured: true };
}

function bookingDateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: process.env.BARBER_TIME_ZONE || "America/Argentina/Buenos_Aires",
  });
}

export async function sendBookingCreatedPush(input: {
  tenantId: string;
  bookingId: string;
  service: string;
  date: string;
  time: string;
}) {
  await connectDB();
  const subscriptions = await PushSubscriptionModel.find({
    tenantId: input.tenantId,
    enabled: true,
  })
    .select("endpoint keys expirationTime failureCount")
    .lean();

  const result = await deliverToSubscriptions(subscriptions, {
    title: "Nueva reserva",
    body: `${input.service} · ${bookingDateLabel(input.date)} · ${input.time} h`,
    url: "/admin",
    tag: `booking-${input.bookingId}`,
  });

  console.info("booking-push-delivery", {
    bookingId: input.bookingId,
    sent: result.sent,
    failed: result.failed,
    removed: result.removed,
    configured: result.configured,
  });
  return result;
}

export async function sendTestPush(input: { tenantId: string; endpoint: string }) {
  await connectDB();
  const subscription = await PushSubscriptionModel.findOne({
    tenantId: input.tenantId,
    endpoint: input.endpoint,
    enabled: true,
  })
    .select("endpoint keys expirationTime failureCount")
    .lean();

  if (!subscription) {
    return { sent: 0, failed: 0, removed: 0, configured: configureWebPush() };
  }

  return deliverToSubscriptions([subscription], {
    title: "Notificaciones activadas",
    body: "Este dispositivo ya puede recibir las nuevas reservas de tu barbería.",
    url: "/admin",
    tag: `push-test-${Date.now()}`,
  });
}

export function pushIsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
  );
}

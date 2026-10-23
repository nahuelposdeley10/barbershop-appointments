import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { localDateStr } from "@/lib/booking-logic";
import { kapsoSendReminder } from "@/lib/kapso";
import { Booking } from "@/lib/models/Booking";
import { Setting } from "@/lib/models/Setting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function appointmentAt(date: string, time: string) {
  // The booking app currently operates in Argentina (UTC-03), with no DST.
  return new Date(`${date}T${time}:00-03:00`);
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json(
      { error: process.env.CRON_SECRET ? "No autorizado" : "CRON_SECRET no está configurado" },
      { status: process.env.CRON_SECRET ? 401 : 503 }
    );
  }

  await connectDB();
  const now = new Date();
  const today = localDateStr(now);
  const tomorrowDate = new Date(`${today}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateStr(tomorrowDate);
  const settings = await Setting.find({
    whatsappRemindersEnabled: true,
    kapsoConnectionStatus: "connected",
    kapsoPhoneNumberId: { $exists: true, $ne: "" },
    whatsappTemplateName: { $exists: true, $ne: "" },
  })
    .select("tenantId kapsoPhoneNumberId whatsappReminderMinutes whatsappTemplateName whatsappTemplateLanguage")
    .lean();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const setting of settings) {
    const reminderMinutes = setting.whatsappReminderMinutes === 30 ? 30 : 60;
    const candidateBookings = await Booking.find({
      tenantId: setting.tenantId,
      date: { $in: [today, tomorrow] },
      status: "confirmed",
      whatsappOptIn: true,
      phone: { $exists: true, $ne: "" },
      $or: [
        { whatsappReminderStatus: "pending" },
        { whatsappReminderStatus: "processing", whatsappReminderClaimedAt: { $lt: new Date(Date.now() - 10 * 60_000) } },
      ],
    })
      .select("_id name phone service date time whatsappReminderStatus")
      .lean();

    for (const candidate of candidateBookings) {
      const target = appointmentAt(candidate.date, candidate.time).getTime() - reminderMinutes * 60_000;
      const difference = target - now.getTime();
      if (difference < -5 * 60_000 || difference > 5 * 60_000) continue;

      const claimed = await Booking.findOneAndUpdate(
        {
          _id: candidate._id,
          $or: [
            { whatsappReminderStatus: "pending" },
            { whatsappReminderStatus: "processing", whatsappReminderClaimedAt: { $lt: new Date(Date.now() - 10 * 60_000) } },
          ],
        },
        { $set: { whatsappReminderStatus: "processing", whatsappReminderClaimedAt: new Date(), whatsappReminderError: "" } },
        { new: true }
      ).lean();
      if (!claimed) {
        skipped += 1;
        continue;
      }

      try {
        const result = await kapsoSendReminder({
          phoneNumberId: String(setting.kapsoPhoneNumberId),
          to: candidate.phone,
          templateName: String(setting.whatsappTemplateName),
          languageCode: String(setting.whatsappTemplateLanguage || "es_AR"),
          parameters: [candidate.name, candidate.service, formatDate(candidate.date), candidate.time],
          callbackData: `booking:${String(candidate._id)}`,
        });
        await Booking.updateOne(
          { _id: candidate._id },
          { $set: { whatsappReminderStatus: "sent", whatsappReminderSentAt: new Date(), whatsappReminderMessageId: result.messageId } }
        );
        sent += 1;
      } catch (error) {
        await Booking.updateOne(
          { _id: candidate._id },
          { $set: { whatsappReminderStatus: "failed", whatsappReminderError: error instanceof Error ? error.message.slice(0, 300) : "No pudimos enviar el recordatorio" } }
        );
        failed += 1;
      }
    }
  }

  return Response.json({ ok: true, processedTenants: settings.length, sent, failed, skipped, ranAt: now.toISOString() });
}

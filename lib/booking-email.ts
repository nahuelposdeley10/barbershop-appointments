import nodemailer from "nodemailer";

type BookingNotification = {
  bookingId: string;
  recipient: string;
  barberName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  price: number;
};

export type BookingEmailResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "invalid-recipient" | "send-failed" };

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBookingDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function adminUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) return "";
  try {
    return new URL("/admin", siteUrl).toString();
  } catch {
    return "";
  }
}

export async function sendBookingCreatedEmail(
  notification: BookingNotification
): Promise<BookingEmailResult> {
  const smtpUser = process.env.SMTP_USER?.trim() || "";
  const smtpPassword = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "") || "";
  if (!smtpUser || !smtpPassword) return { sent: false, reason: "not-configured" };
  if (!validEmail(notification.recipient)) return { sent: false, reason: "invalid-recipient" };

  const businessName = notification.barberName.trim() || "Barbería";
  const dateLabel = formatBookingDate(notification.date);
  const priceLabel = formatMoney(notification.price);
  const panelUrl = adminUrl();
  const subject = `Nueva reserva · ${notification.service} · ${notification.date} ${notification.time}`
    .replace(/[\r\n]+/g, " ")
    .slice(0, 180);
  const text = [
    `Nueva reserva en ${businessName}`,
    "",
    `Cliente: ${notification.customerName}`,
    `Teléfono: ${notification.customerPhone}`,
    `Servicio: ${notification.service}`,
    `Fecha: ${dateLabel}`,
    `Horario: ${notification.time} h`,
    `Duración: ${notification.duration} min`,
    `Precio: ${priceLabel}`,
    panelUrl ? `Ver agenda: ${panelUrl}` : "",
  ].filter(Boolean).join("\n");

  const rows = [
    ["Cliente", notification.customerName],
    ["Teléfono", notification.customerPhone],
    ["Servicio", notification.service],
    ["Fecha", dateLabel],
    ["Horario", `${notification.time} h`],
    ["Duración", `${notification.duration} min`],
    ["Precio", priceLabel],
  ].map(([label, value]) => `
    <tr>
      <td style="padding:10px 12px;color:#8d8d96;border-bottom:1px solid #29292f;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:10px 12px;color:#f5f5f6;border-bottom:1px solid #29292f;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
    </tr>`).join("");

  const html = `<!doctype html>
  <html lang="es">
    <body style="margin:0;background:#0d0d0f;font-family:Arial,sans-serif;color:#f5f5f6;">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
        <div style="height:5px;border-radius:12px 12px 0 0;background:linear-gradient(90deg,#3267bd 0 20%,#fff 20% 40%,#d83a3a 40% 60%,#fff 60% 80%,#3267bd 80%);"></div>
        <div style="background:#18181c;border:1px solid #2b2b31;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
          <p style="margin:0 0 8px;color:#dca845;font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">BarberYá</p>
          <h1 style="margin:0;font-size:25px;line-height:1.25;">Nueva reserva confirmada</h1>
          <p style="margin:10px 0 22px;color:#aaaab2;font-size:14px;line-height:1.6;">Se agregó un nuevo turno a la agenda de ${escapeHtml(businessName)}.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;background:#121215;border:1px solid #29292f;border-radius:12px;overflow:hidden;">${rows}</table>
          ${panelUrl ? `<a href="${escapeHtml(panelUrl)}" style="display:block;margin-top:22px;padding:13px 18px;border-radius:10px;background:#dca845;color:#17130b;text-decoration:none;text-align:center;font-weight:800;">Abrir agenda</a>` : ""}
          <p style="margin:20px 0 0;color:#73737d;font-size:12px;line-height:1.5;">Este aviso se generó automáticamente porque la barbería tiene activadas las notificaciones de nuevas reservas.</p>
        </div>
      </div>
    </body>
  </html>`;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({
      from: {
        name: process.env.SMTP_FROM_NAME?.trim() || "BarberYá",
        address: smtpUser,
      },
      to: notification.recipient,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error("[booking-email] No se pudo enviar el aviso", {
      bookingId: notification.bookingId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false, reason: "send-failed" };
  }
}

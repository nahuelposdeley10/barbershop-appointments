import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getAdminContext } from "@/lib/auth";
import { getSettings } from "@/lib/booking-logic";
import { isKapsoConfigured, kapsoCreateCustomer, kapsoCreateSetupLink, kapsoListPhoneNumbers, kapsoListTemplates } from "@/lib/kapso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicStatus(setting: Record<string, unknown>) {
  return {
    enabled: Boolean(setting.whatsappRemindersEnabled),
    configured: isKapsoConfigured(),
    connectionStatus: setting.kapsoConnectionStatus || "disabled",
    displayPhone: typeof setting.kapsoDisplayPhone === "string" ? setting.kapsoDisplayPhone : "",
    reminderMinutes: setting.whatsappReminderMinutes === 30 ? 30 : 60,
    templateName: typeof setting.whatsappTemplateName === "string" ? setting.whatsappTemplateName : "",
    templateLanguage: typeof setting.whatsappTemplateLanguage === "string" ? setting.whatsappTemplateLanguage : "es_AR",
    setupLinkAvailable: Boolean(setting.kapsoCustomerId),
    ...(setting.kapsoLastError ? { lastError: String(setting.kapsoLastError).slice(0, 300) } : {}),
    ...(setting.kapsoLastSyncedAt ? { lastSyncedAt: new Date(String(setting.kapsoLastSyncedAt)).toISOString() } : {}),
  };
}

async function getOwnerSetting(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return { error: Response.json({ error: "No autorizado" }, { status: 401 }) } as const;
  if (context.role === "superadmin") {
    return { error: Response.json({ error: "Entrá a una barbería para administrar su conexión" }, { status: 403 }) } as const;
  }
  await connectDB();
  const setting = await getSettings(context.tenantId);
  if (!setting.whatsappRemindersEnabled) {
    return { error: Response.json({ error: "WhatsApp no está habilitado para esta barbería" }, { status: 403 }) } as const;
  }
  return { context, setting } as const;
}

export async function GET(req: NextRequest) {
  const result = await getOwnerSetting(req);
  if (result.error) return result.error;
  return Response.json(publicStatus(result.setting.toObject()));
}

export async function POST(req: NextRequest) {
  const result = await getOwnerSetting(req);
  if (result.error) return result.error;
  const { context, setting } = result;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "save") {
    const reminderMinutes = Number(body.reminderMinutes);
    const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
    const templateLanguage = typeof body.templateLanguage === "string" ? body.templateLanguage.trim() : "es_AR";
    if (reminderMinutes !== 30 && reminderMinutes !== 60) {
      return Response.json({ error: "Elegí un recordatorio de 30 o 60 minutos" }, { status: 400 });
    }
    if (!/^[a-z0-9_]{2,80}$/.test(templateName)) {
      return Response.json({ error: "Ingresá el nombre exacto de una plantilla aprobada de WhatsApp" }, { status: 400 });
    }
    if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(templateLanguage)) {
      return Response.json({ error: "El idioma de la plantilla no es válido" }, { status: 400 });
    }
    setting.whatsappReminderMinutes = reminderMinutes;
    setting.whatsappTemplateName = templateName;
    setting.whatsappTemplateLanguage = templateLanguage;
    await setting.save();
    return Response.json(publicStatus(setting.toObject()));
  }

  if (action !== "setup" && action !== "sync") {
    return Response.json({ error: "Acción no válida" }, { status: 400 });
  }

  if (!isKapsoConfigured()) {
    return Response.json({ error: "Falta configurar KAPSO_API_KEY en las variables privadas del servidor" }, { status: 503 });
  }

  try {
    if (!setting.kapsoCustomerId) {
      const customer = await kapsoCreateCustomer(
        setting.barberName || "Barbería",
        `barberia:${context.tenantId || "legacy"}`
      );
      setting.kapsoCustomerId = customer.id || "";
    }

    if (action === "setup") {
      const setup = await kapsoCreateSetupLink(setting.kapsoCustomerId);
      setting.kapsoSetupLinkId = setup.id || "";
      setting.kapsoConnectionStatus = "pending";
      setting.kapsoLastError = "";
      setting.kapsoLastSyncedAt = new Date();
      await setting.save();
      return Response.json({ setupUrl: setup.url, status: publicStatus(setting.toObject()) });
    }

    const phoneNumbers = await kapsoListPhoneNumbers(setting.kapsoCustomerId);
    const connected = phoneNumbers.find((phone) =>
      String(phone.status || "").toLowerCase() === "active" || String(phone.status || "").toLowerCase() === "connected"
    ) || phoneNumbers[0];
    if (!connected) {
      setting.kapsoConnectionStatus = "pending";
      setting.kapsoLastError = "Todavía no hay un número conectado";
    } else {
      setting.kapsoPhoneNumberId = connected.phone_number_id || connected.id || "";
      setting.kapsoBusinessAccountId = connected.business_account_id || "";
      setting.kapsoDisplayPhone = connected.display_phone_number || "";
      setting.kapsoConnectionStatus = setting.kapsoPhoneNumberId ? "connected" : "pending";
      setting.kapsoLastError = "";
    }
    setting.kapsoLastSyncedAt = new Date();
    await setting.save();
    const templates = setting.kapsoBusinessAccountId
      ? (await kapsoListTemplates(setting.kapsoBusinessAccountId))
          .filter((template) => String(template.status || "").toUpperCase() === "APPROVED")
          .map((template) => ({
            name: template.name || "",
            language: template.language || "",
            status: template.status || "",
            ...(template.category ? { category: template.category } : {}),
          }))
      : [];
    return Response.json({ status: publicStatus(setting.toObject()), templates });
  } catch (error) {
    setting.kapsoConnectionStatus = "error";
    setting.kapsoLastError = error instanceof Error ? error.message.slice(0, 300) : "No pudimos consultar Kapso";
    setting.kapsoLastSyncedAt = new Date();
    await setting.save();
    return Response.json({ error: "No pudimos completar la conexión con Kapso" }, { status: 502 });
  }
}

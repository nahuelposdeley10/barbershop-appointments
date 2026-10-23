import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getAdminContext } from "@/lib/auth";
import { Setting } from "@/lib/models/Setting";
import { Tenant } from "@/lib/models/Tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (context.role !== "superadmin") return Response.json({ error: "Solo disponible para superadmin" }, { status: 403 });

  const { id } = await params;
  let body: { whatsappRemindersEnabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (typeof body.whatsappRemindersEnabled !== "boolean") {
    return Response.json({ error: "Indicá si WhatsApp queda habilitado" }, { status: 400 });
  }

  await connectDB();
  const tenant = await Tenant.findById(id).select("_id name slug").lean();
  if (!tenant) return Response.json({ error: "Barbería no encontrada" }, { status: 404 });
  const setting = await Setting.findOneAndUpdate(
    { tenantId: tenant._id },
    {
      $set: {
        whatsappRemindersEnabled: body.whatsappRemindersEnabled,
        ...(body.whatsappRemindersEnabled ? {} : {
          kapsoConnectionStatus: "disabled",
          kapsoPhoneNumberId: "",
          kapsoBusinessAccountId: "",
          kapsoDisplayPhone: "",
        }),
      },
      $setOnInsert: { tenantId: tenant._id },
    },
    { new: true, upsert: true }
  ).lean();
  return Response.json({
    tenantId: String(tenant._id),
    whatsappRemindersEnabled: Boolean(setting?.whatsappRemindersEnabled),
    whatsappConnectionStatus: setting?.kapsoConnectionStatus || "disabled",
  });
}

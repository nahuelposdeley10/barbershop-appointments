import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { defaultSettings } from "@/lib/booking-logic";
import { getAdminContext, hashPassword } from "@/lib/auth";
import { AdminUser } from "@/lib/models/AdminUser";
import { Setting } from "@/lib/models/Setting";
import { Tenant } from "@/lib/models/Tenant";
import { isValidTenantSlug, normalizeTenantSlug } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function GET(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (context.role !== "superadmin") return Response.json({ error: "Solo disponible para superadmin" }, { status: 403 });
  await connectDB();
  const tenants = await Tenant.find().populate("ownerId", "email").sort({ createdAt: 1 }).lean();
  const tenantIds = tenants.map((tenant) => tenant._id);
  const settings = await Setting.find({ tenantId: { $in: tenantIds } })
    .select("tenantId whatsappRemindersEnabled kapsoConnectionStatus")
    .lean();
  const settingsByTenant = new Map(settings.map((setting) => [String(setting.tenantId), setting]));
  return Response.json(
    tenants.map((tenant) => ({
      ...tenant,
      whatsappRemindersEnabled: Boolean(settingsByTenant.get(String(tenant._id))?.whatsappRemindersEnabled),
      whatsappConnectionStatus: settingsByTenant.get(String(tenant._id))?.kapsoConnectionStatus || "disabled",
    }))
  );
}

export async function POST(req: NextRequest) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (context.role !== "superadmin") return Response.json({ error: "Solo disponible para superadmin" }, { status: 403 });

  let body: { name?: string; slug?: string; ownerEmail?: string; ownerPassword?: string; whatsappRemindersEnabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const slug = normalizeTenantSlug(body.slug || name);
  const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : "";
  const ownerPassword = typeof body.ownerPassword === "string" ? body.ownerPassword : "";
  if (name.length < 2) return Response.json({ error: "Ingresá el nombre de la barbería" }, { status: 400 });
  if (!isValidTenantSlug(slug)) return Response.json({ error: "El identificador de la barbería no es válido" }, { status: 400 });
  if (!validEmail(ownerEmail)) return Response.json({ error: "Ingresá un email válido para el dueño" }, { status: 400 });
  if (ownerPassword.length < 4 || ownerPassword.length > 128) {
    return Response.json({ error: "La contraseña debe tener entre 4 y 128 caracteres" }, { status: 400 });
  }

  await connectDB();
  const session = await mongoose.startSession();
  try {
    let created: { id: string; slug: string; name: string; ownerEmail: string } | null = null;
    await session.withTransaction(async () => {
      const [owner] = await AdminUser.create(
        [{ email: ownerEmail, passwordHash: hashPassword(ownerPassword), role: "owner", tenantId: null }],
        { session }
      );
      const [tenant] = await Tenant.create(
        [{ slug, name, ownerId: String(owner._id), status: "active" }],
        { session }
      );
      await AdminUser.updateOne({ _id: owner._id }, { $set: { tenantId: tenant._id } }, { session });
      await Setting.create([{
        tenantId: tenant._id,
        ...defaultSettings(),
        barberName: name,
        whatsappRemindersEnabled: Boolean(body.whatsappRemindersEnabled),
      }], { session });
      created = { id: String(tenant._id), slug: tenant.slug, name: tenant.name, ownerEmail };
    });
    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error || (error as { code?: number })?.code === 11000) {
      return Response.json({ error: "El slug o el email del dueño ya está en uso" }, { status: 409 });
    }
    console.error(error);
    return Response.json({ error: "No pudimos crear la barbería" }, { status: 500 });
  } finally {
    await session.endSession();
  }
}

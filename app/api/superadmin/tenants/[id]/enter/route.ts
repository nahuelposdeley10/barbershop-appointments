import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSession, getAdminContext, setAdminSessionCookie } from "@/lib/auth";
import { AdminUser } from "@/lib/models/AdminUser";
import { Tenant } from "@/lib/models/Tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getAdminContext(req);
  if (!context) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (context.role !== "superadmin" || context.isImpersonating) {
    return Response.json({ error: "Solo disponible para superadmin" }, { status: 403 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: "Barbería inválida" }, { status: 400 });
  }

  const tenant = await Tenant.findOne({ _id: id, status: "active" }).lean();
  if (!tenant) return Response.json({ error: "No encontramos esa barbería activa" }, { status: 404 });

  const owner = await AdminUser.findOne({
    _id: tenant.ownerId,
    role: "owner",
    tenantId: tenant._id,
  }).select("_id").lean();
  if (!owner) return Response.json({ error: "La barbería no tiene un dueño válido" }, { status: 409 });

  const token = await createAdminSession(String(owner._id), context.userId);
  const response = NextResponse.json({
    authenticated: true,
    role: "owner",
    tenantId: String(tenant._id),
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    isImpersonating: true,
  });
  setAdminSessionCookie(response, token);
  return response;
}

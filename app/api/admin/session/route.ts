import { NextRequest } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { Tenant } from "@/lib/models/Tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = await getAdminContext(req);
  const tenant = context?.tenantId
    ? await Tenant.findById(context.tenantId).select("name slug").lean()
    : null;
  return Response.json({
    authenticated: Boolean(context),
    ...(context
      ? {
          role: context.role,
          tenantId: context.tenantId,
          email: context.email,
          isImpersonating: context.isImpersonating,
          tenantName: tenant?.name || null,
          tenantSlug: tenant?.slug || null,
        }
      : {}),
  });
}

import { Tenant, type TenantDoc } from "@/lib/models/Tenant";
import { connectDB } from "@/lib/db";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeTenantSlug(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63)
    : "";
}

export function isValidTenantSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && SLUG_PATTERN.test(slug);
}

export async function getTenantBySlug(slug: string): Promise<TenantDoc | null> {
  if (!isValidTenantSlug(slug)) return null;
  await connectDB();
  return Tenant.findOne({ slug, status: "active" }).lean();
}

export function tenantFilter(tenantId: string): Record<string, string> {
  return { tenantId };
}

export function hasExplicitTenantSelector(req: Request): boolean {
  const url = new URL(req.url);
  return url.searchParams.has("tenant") || Boolean(req.headers.get("x-tenant-slug"));
}

export function tenantQueryFromRequest(req: Request): string {
  const url = new URL(req.url);
  return normalizeTenantSlug(url.searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "");
}

export async function getTenantForRequest(req: Request): Promise<TenantDoc | null> {
  const slug = tenantQueryFromRequest(req);
  return slug ? getTenantBySlug(slug) : null;
}

export async function resolveTenantForRequest(req: Request): Promise<{
  tenant: TenantDoc | null;
  explicit: boolean;
}> {
  const explicit = hasExplicitTenantSelector(req);
  return {
    tenant: await getTenantForRequest(req),
    explicit,
  };
}

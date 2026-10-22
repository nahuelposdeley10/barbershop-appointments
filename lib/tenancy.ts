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

export async function getDefaultTenant(): Promise<TenantDoc | null> {
  await connectDB();
  const configured = normalizeTenantSlug(process.env.DEFAULT_TENANT_SLUG || "");
  if (configured) {
    const tenant = await Tenant.findOne({ slug: configured, status: "active" }).lean();
    if (tenant) return tenant;
  }
  return Tenant.findOne({ status: "active" }).sort({ createdAt: 1 }).lean();
}

export async function getTenantForSlugOrDefault(slug?: string | null): Promise<TenantDoc | null> {
  return slug ? getTenantBySlug(normalizeTenantSlug(slug)) : getDefaultTenant();
}

export function tenantFilter(tenantId?: string | null): Record<string, string> {
  return tenantId ? { tenantId } : {};
}

export function tenantQueryFromRequest(req: Request): string {
  const url = new URL(req.url);
  return normalizeTenantSlug(url.searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "");
}

export async function getTenantForRequest(req: Request): Promise<TenantDoc | null> {
  return getTenantForSlugOrDefault(tenantQueryFromRequest(req));
}

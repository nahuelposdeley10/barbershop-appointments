import type { MetadataRoute } from "next";
import { connectDB } from "@/lib/db";
import { Tenant } from "@/lib/models/Tenant";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/reservar`, changeFrequency: "weekly", priority: 0.9 },
  ];
  try {
    await connectDB();
    const tenants = await Tenant.find({ status: "active" }).select("slug updatedAt").lean();
    for (const tenant of tenants) {
      const updatedAt = (tenant as unknown as { updatedAt?: Date }).updatedAt
        ? new Date((tenant as unknown as { updatedAt: Date }).updatedAt)
        : undefined;
      entries.push(
        { url: `${baseUrl}/b/${tenant.slug}`, lastModified: updatedAt, changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/b/${tenant.slug}/reservar`, lastModified: updatedAt, changeFrequency: "weekly", priority: 0.8 },
      );
    }
  } catch {
    // Mantener el sitemap base disponible aunque MongoDB esté temporalmente caída.
  }
  return entries;
}

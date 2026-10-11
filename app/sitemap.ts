import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/reservar`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/terminos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}

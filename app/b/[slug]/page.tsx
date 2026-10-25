import Home from "../../page";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSettings } from "@/lib/booking-logic";
import { getTenantBySlug, normalizeTenantSlug } from "@/lib/tenancy";

type Props = { params: Promise<{ slug: string }> };

export default async function TenantHome({ params }: Props) {
  const { slug } = await params;
  const normalizedSlug = normalizeTenantSlug(slug);
  const tenant = await getTenantBySlug(normalizedSlug);
  if (!tenant) notFound();
  return <Home tenantSlug={normalizedSlug} />;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(normalizeTenantSlug(slug));
  if (!tenant) return { title: "Barbería no encontrada", robots: { index: false, follow: false } };
  const settings = await getSettings(String(tenant._id));
  const title = settings.barberName || tenant.name;
  return {
    title: `${title} | Reservá tu turno`,
    description: settings.heroDescription || settings.message,
    alternates: { canonical: `/b/${tenant.slug}` },
    openGraph: {
      title,
      description: settings.heroDescription || settings.message,
      images: settings.imgHero ? [settings.imgHero] : undefined,
      type: "website",
    },
  };
}

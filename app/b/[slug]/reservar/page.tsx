import BookingPage from "../../../components/booking/BookingPage";
import { notFound } from "next/navigation";
import { getTenantBySlug, normalizeTenantSlug } from "@/lib/tenancy";

type Props = { params: Promise<{ slug: string }> };

export default async function TenantBooking({ params }: Props) {
  const { slug } = await params;
  const normalizedSlug = normalizeTenantSlug(slug);
  const tenant = await getTenantBySlug(normalizedSlug);
  if (!tenant) notFound();
  return <BookingPage tenantSlug={normalizedSlug} />;
}

import BookingPage from "../../../components/booking/BookingPage";

type Props = { params: Promise<{ slug: string }> };

export default async function TenantBooking({ params }: Props) {
  const { slug } = await params;
  return <BookingPage tenantSlug={slug} />;
}

import Home from "../../page";

type Props = { params: Promise<{ slug: string }> };

export default async function TenantHome({ params }: Props) {
  const { slug } = await params;
  return <Home searchParams={Promise.resolve({ tenant: slug })} />;
}

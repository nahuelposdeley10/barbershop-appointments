import { connectDB } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    return Response.json({ ok: true, service: "barberia-web" });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json({ ok: false, service: "barberia-web" }, { status: 503 });
  }
}

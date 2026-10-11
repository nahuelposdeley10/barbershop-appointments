import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return Response.json({ authenticated: await requireAdmin(req) });
}

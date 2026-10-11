import { NextRequest, NextResponse } from "next/server";
import { clearAdminSessionCookie, revokeAdminSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await revokeAdminSession(req);
  const response = NextResponse.json({ authenticated: false });
  clearAdminSessionCookie(response);
  return response;
}

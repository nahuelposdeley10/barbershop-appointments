import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { logRequestError, requestId, withRequestId } from "@/lib/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = requestId(req);
  const startedAt = performance.now();
  try {
    await connectDB();
    return withRequestId(
      Response.json({
        ok: true,
        service: "barberia-web",
        db: mongoose.connection.readyState === 1 ? "connected" : "not-ready",
        latencyMs: Math.round(performance.now() - startedAt),
      }),
      id
    );
  } catch (error) {
    logRequestError("health", id, error);
    return withRequestId(
      Response.json(
        { ok: false, service: "barberia-web", db: "unavailable", requestId: id },
        { status: 503 }
      ),
      id
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// S-14: liveness + readiness probe. Reports DB connectivity, configured AI
// provider, and the git SHA the container was built from. Returns 503 when
// the database round-trip fails so ACA / load balancers can shed traffic.
export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
  } catch (err) {
    dbError = (err as Error)?.message ?? String(err);
  }
  const payload = {
    status: dbOk ? "ok" : "degraded",
    time: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    db: { ok: dbOk, error: dbError },
    aiProvider: process.env.AI_PROVIDER ?? "demo",
    gitSha: process.env.GIT_SHA ?? null,
    env: process.env.NODE_ENV ?? "unknown",
  };
  return NextResponse.json(payload, { status: dbOk ? 200 : 503 });
}

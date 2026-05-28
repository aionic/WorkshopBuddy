import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Auto-fail any run still marked Running after this many ms. The orchestrator
// works in-process; if the container restarts mid-run the row will be orphaned.
const STALE_RUN_MS = 20 * 60 * 1000; // 20 minutes

export const GET = withProjectAuth<{ projectId: string; runId: string }>(async (_req, { params }) => {
  const run = await prisma.agentRun.findUnique({ where: { id: params.runId } });
  if (!run || run.projectId !== params.projectId) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Recover from orphaned Running rows (e.g. container was restarted mid-run).
  if (run.status === "Running" && run.startedAt && Date.now() - new Date(run.startedAt).getTime() > STALE_RUN_MS) {
    const failed = await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "Failed",
        completedAt: new Date(),
        outputJson: JSON.stringify({ error: "Run exceeded maximum duration; container may have restarted." })
      }
    });
    return NextResponse.json(buildResponse(failed));
  }

  return NextResponse.json(buildResponse(run));
});

function buildResponse(run: {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  outputJson: string | null;
}) {
  const out = run.outputJson ? safeParse(run.outputJson) : null;
  return {
    runId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    agents: out?.agents ?? null,
    review: out?.review ?? null,
    usedLiveAI: out?.usedLiveAI ?? null,
    error: out?.error ?? null
  };
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

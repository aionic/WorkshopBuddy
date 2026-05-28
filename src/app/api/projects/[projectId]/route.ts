import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { projectUpdateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export const GET = withProjectAuth(async (_req, { params }) => {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      inputs: { orderBy: { createdAt: "desc" } },
      artifacts: { orderBy: { updatedAt: "desc" } },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
});

export const PUT = withProjectAuth(async (req, { params }) => {
  const parsed = await parseBody(req, projectUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  // Build the prisma update payload: scalar fields pass through, JSON-encoded
  // fields are stringified, undefined fields are skipped.
  const data: Record<string, unknown> = {};
  for (const k of ["name", "clientName", "tpid", "msxOppId", "industry", "businessProblem", "timeHorizon", "status"] as const) {
    const v = (parsed as Record<string, unknown>)[k];
    if (v !== undefined) data[k] = v;
  }
  for (const k of ["desiredOutcomes", "targetAudience", "selectedArtifacts"] as const) {
    const v = (parsed as Record<string, unknown>)[k];
    if (v !== undefined) data[k] = JSON.stringify(v);
  }
  const project = await prisma.project.update({ where: { id: params.projectId }, data });
  return NextResponse.json(project);
});

export const DELETE = withProjectAuth(async (_req, { params }) => {
  await prisma.project.delete({ where: { id: params.projectId } });
  return NextResponse.json({ ok: true });
});

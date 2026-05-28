import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertProjectAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { projectId: string } };

export const GET = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
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

export const PUT = withAuth<[Ctx]>(async (req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["name", "clientName", "tpid", "msxOppId", "industry", "businessProblem", "timeHorizon", "status"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  for (const k of ["desiredOutcomes", "targetAudience", "selectedArtifacts"]) {
    if (body[k] !== undefined) data[k] = JSON.stringify(body[k]);
  }
  const project = await prisma.project.update({ where: { id: params.projectId }, data });
  return NextResponse.json(project);
});

export const DELETE = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
  await prisma.project.delete({ where: { id: params.projectId } });
  return NextResponse.json({ ok: true });
});

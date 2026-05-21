import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
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
}

export async function PUT(req: Request, { params }: { params: { projectId: string } }) {
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
}

export async function DELETE(_: Request, { params }: { params: { projectId: string } }) {
  await prisma.project.delete({ where: { id: params.projectId } });
  return NextResponse.json({ ok: true });
}

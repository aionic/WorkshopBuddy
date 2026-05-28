import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, user) => {
  const projects = await prisma.project.findMany({
    where: { ownerId: user.oid },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { inputs: true, artifacts: true, agentRuns: true } } }
  });
  return NextResponse.json(projects);
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  if (!body?.name || !body?.businessProblem) {
    return NextResponse.json({ error: "name and businessProblem are required" }, { status: 400 });
  }
  const project = await prisma.project.create({
    data: {
      ownerId: user.oid,
      name: body.name,
      clientName: body.clientName ?? null,
      tpid: body.tpid ?? null,
      msxOppId: body.msxOppId ?? null,
      industry: body.industry ?? null,
      businessProblem: body.businessProblem,
      desiredOutcomes: JSON.stringify(body.desiredOutcomes ?? []),
      targetAudience: JSON.stringify(body.targetAudience ?? []),
      selectedArtifacts: JSON.stringify(
        body.selectedArtifacts ?? ["Impact Statement", "Executive Briefing Deck", "Solution Map", "90-Day Execution Plan"]
      ),
      timeHorizon: body.timeHorizon ?? null,
      status: "Active"
    }
  });
  return NextResponse.json(project, { status: 201 });
});

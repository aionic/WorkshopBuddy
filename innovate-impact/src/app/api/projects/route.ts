import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { inputs: true, artifacts: true, agentRuns: true } } }
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.name || !body?.businessProblem) {
    return NextResponse.json({ error: "name and businessProblem are required" }, { status: 400 });
  }
  const project = await prisma.project.create({
    data: {
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
}

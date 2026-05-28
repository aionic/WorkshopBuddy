import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { projectCreateSchema } from "@/lib/api/schemas";

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
  const parsed = await parseBody(req, projectCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const project = await prisma.project.create({
    data: {
      ownerId: user.oid,
      name: parsed.name,
      clientName: parsed.clientName ?? null,
      tpid: parsed.tpid ?? null,
      msxOppId: parsed.msxOppId ?? null,
      industry: parsed.industry ?? null,
      businessProblem: parsed.businessProblem,
      desiredOutcomes: JSON.stringify(parsed.desiredOutcomes ?? []),
      targetAudience: JSON.stringify(parsed.targetAudience ?? []),
      selectedArtifacts: JSON.stringify(
        parsed.selectedArtifacts ?? ["Impact Statement", "Executive Briefing Deck", "Solution Map", "90-Day Execution Plan"]
      ),
      timeHorizon: parsed.timeHorizon ?? null,
      status: "Active"
    }
  });
  return NextResponse.json(project, { status: 201 });
});

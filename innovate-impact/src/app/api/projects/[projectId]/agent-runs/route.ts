import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runInnovationWorkflow } from "@/lib/agents/orchestrator";
import type { ArtifactType } from "@/lib/artifacts/artifact-schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const runs = await prisma.agentRun.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(runs);
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    artifactTypes?: ArtifactType[];
    customInstructions?: string;
  };

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { inputs: true }
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const run = await prisma.agentRun.create({
    data: {
      projectId: project.id,
      status: "Running",
      inputJson: JSON.stringify({ mode: body.mode ?? "full_workflow", artifactTypes: body.artifactTypes, customInstructions: body.customInstructions }),
      startedAt: new Date()
    }
  });

  // Fire-and-forget: orchestrator can take many minutes (well past the 240s ACA
  // ingress timeout). Kick off the work but don't await it on the request path.
  // The client polls GET /api/projects/:id/agent-runs/:runId for completion.
  void executeRunInBackground(run.id, project, body);

  return NextResponse.json({ runId: run.id, status: "Running" }, { status: 202 });
}

async function executeRunInBackground(
  runId: string,
  project: any,
  body: { mode?: string; artifactTypes?: ArtifactType[]; customInstructions?: string }
) {
  try {
    const result = await runInnovationWorkflow(project, project.inputs, {
      artifactTypes: body.artifactTypes,
      customInstructions: body.customInstructions
    });

    // Persist artifacts (upsert by type for this project)
    for (const a of result.artifacts) {
      const existing = await prisma.artifact.findFirst({ where: { projectId: project.id, artifactType: a.artifactType } });
      if (existing) {
        const nextVersion = existing.currentVersion + 1;
        await prisma.artifactVersion.create({
          data: { artifactId: existing.id, version: existing.currentVersion, contentJson: existing.contentJson, markdown: existing.markdown }
        });
        await prisma.artifact.update({
          where: { id: existing.id },
          data: {
            title: a.content.title,
            contentJson: JSON.stringify(a.content),
            markdown: a.markdown,
            currentVersion: nextVersion,
            status: "Draft"
          }
        });
      } else {
        await prisma.artifact.create({
          data: {
            projectId: project.id,
            artifactType: a.artifactType,
            title: a.content.title,
            contentJson: JSON.stringify(a.content),
            markdown: a.markdown
          }
        });
      }
    }

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "Completed",
        completedAt: new Date(),
        outputJson: JSON.stringify({
          agents: result.agents.map((a) => ({ name: a.name, status: a.status, summary: a.summary, usedLLM: a.usedLLM, llmError: a.llmError, durationMs: a.durationMs })),
          review: result.review,
          usedLiveAI: result.usedLiveAI
        }),
        logJson: JSON.stringify(result.agents.map((a) => ({ name: a.name, status: a.status })))
      }
    });
  } catch (err) {
    console.error(`[agent-runs] Background run ${runId} failed:`, err);
    await prisma.agentRun
      .update({
        where: { id: runId },
        data: { status: "Failed", completedAt: new Date(), outputJson: JSON.stringify({ error: (err as Error).message }) }
      })
      .catch((e) => console.error(`[agent-runs] Failed to mark run ${runId} as Failed:`, e));
  }
}

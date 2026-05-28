import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runInnovationWorkflow } from "@/lib/agents/orchestrator";
import { enqueueAgentRun, isAgentRunQueueConfigured } from "@/lib/agents/queue";
import { persistArtifacts } from "@/lib/agents/persist-artifacts";
import { truncate } from "@/lib/agents/envelope";
import type { ArtifactType } from "@/lib/artifacts/artifact-schemas";
import { withProjectAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { agentRunCreateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export const GET = withProjectAuth(async (_req, { params }) => {
  const runs = await prisma.agentRun.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(runs);
});

export const POST = withProjectAuth(async (req, { params }) => {
  const parsed = await parseBody(req, agentRunCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { inputs: true }
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Create the run in Queued state. The worker (Container Apps Job, KEDA-
  // scaled on the Service Bus queue depth) transitions Queued → Running →
  // Completed/Failed. If Service Bus isn't configured (local dev), we fall
  // back to the legacy fire-and-forget path so the workflow still runs.
  const useQueue = isAgentRunQueueConfigured();
  const run = await prisma.agentRun.create({
    data: {
      projectId: project.id,
      status: useQueue ? "Queued" : "Running",
      inputJson: JSON.stringify({
        mode: body.mode ?? "full_workflow",
        artifactTypes: body.artifactTypes,
        customInstructions: body.customInstructions
      }),
      startedAt: useQueue ? null : new Date()
    }
  });

  if (useQueue) {
    try {
      await enqueueAgentRun({ runId: run.id, projectId: project.id });
    } catch (err) {
      console.error(`[agent-runs] enqueue failed for run ${run.id}:`, err);
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "Failed",
          completedAt: new Date(),
          outputJson: JSON.stringify({ error: truncate(`Enqueue failed: ${(err as Error).message}`) })
        }
      });
      return NextResponse.json({ error: "Failed to queue agent run" }, { status: 502 });
    }
    return NextResponse.json({ runId: run.id, status: "Queued" }, { status: 202 });
  }

  // Local dev fallback: fire-and-forget in-process.
  void executeRunInBackground(run.id, project, body);
  return NextResponse.json({ runId: run.id, status: "Running" }, { status: 202 });
});

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

    // S-6: shared persistence routine (also used by the worker).
    await persistArtifacts(project.id, result.artifacts);

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
        data: { status: "Failed", completedAt: new Date(), outputJson: JSON.stringify({ error: truncate((err as Error).message ?? String(err)) }) }
      })
      .catch((e) => console.error(`[agent-runs] Failed to mark run ${runId} as Failed:`, e));
  }
}

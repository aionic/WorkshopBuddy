import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AgentWorkflowCanvas } from "@/components/agent-workflow-canvas";
import { isLiveAIConfigured } from "@/lib/ai/provider";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      _count: { select: { inputs: true } },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!project) notFound();
  const live = isLiveAIConfigured();
  return (
    <AgentWorkflowCanvas
      project={{
        id: project.id,
        name: project.name,
        inputCount: project._count.inputs,
        selectedArtifacts: parseJsonArray(project.selectedArtifacts),
        recentRuns: project.agentRuns.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          outputJson: r.outputJson
        }))
      }}
      liveAI={live}
    />
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectIntakeWizard } from "@/components/project-intake-wizard";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  const initial = {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    tpid: project.tpid,
    msxOppId: project.msxOppId,
    industry: project.industry,
    businessProblem: project.businessProblem,
    desiredOutcomes: parseJsonArray(project.desiredOutcomes),
    targetAudience: parseJsonArray(project.targetAudience),
    selectedArtifacts: parseJsonArray(project.selectedArtifacts),
    timeHorizon: project.timeHorizon
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Edit project</h1>
      <p className="text-slate-400 text-sm mb-6">Update project metadata, scope, audience, or selected artifacts.</p>
      <ProjectIntakeWizard mode="edit" initial={initial} />
    </div>
  );
}

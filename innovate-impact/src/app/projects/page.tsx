import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { ProjectsList, type ProjectListItem } from "@/components/projects-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { inputs: true, artifacts: true, agentRuns: true } } }
  });
  // Serialize Date objects so they can cross the server/client boundary.
  const serialized: ProjectListItem[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    tpid: p.tpid,
    msxOppId: p.msxOppId,
    industry: p.industry,
    businessProblem: p.businessProblem,
    selectedArtifacts: p.selectedArtifacts,
    updatedAt: p.updatedAt.toISOString(),
    _count: p._count
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 text-sm">All innovation projects in this workspace.</p>
        </div>
        <Link href="/projects/new"><Button><Plus className="w-4 h-4" /> New Project</Button></Link>
      </div>

      <ProjectsList projects={serialized} />
    </div>
  );
}

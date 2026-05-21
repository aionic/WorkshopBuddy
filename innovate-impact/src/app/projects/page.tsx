import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { Plus, ArrowRight } from "lucide-react";
import { parseJsonArray, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { inputs: true, artifacts: true, agentRuns: true } } }
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 text-sm">All innovation projects in this workspace.</p>
        </div>
        <Link href="/projects/new"><Button><Plus className="w-4 h-4" /> New Project</Button></Link>
      </div>

      {projects.length === 0 ? (
        <Card><p className="text-slate-300">No projects yet.</p></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="hover:border-accent/50 transition">
              <CardHeader title={p.name} subtitle={p.clientName ?? p.industry ?? ""} />
              <p className="text-sm text-slate-300 line-clamp-4">{p.businessProblem}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge tone="accent">{p._count.inputs} inputs</Badge>
                <Badge>{p._count.artifacts} artifacts</Badge>
                <Badge>{p._count.agentRuns} runs</Badge>
                {parseJsonArray(p.selectedArtifacts).slice(0, 2).map((a) => (<Badge key={a}>{a}</Badge>))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Updated {formatDate(p.updatedAt)}</span>
                <div className="flex items-center gap-2">
                  <DeleteProjectButton projectId={p.id} projectName={p.name} />
                  <Link href={`/projects/${p.id}`}><Button variant="ghost">Open <ArrowRight className="w-4 h-4" /></Button></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

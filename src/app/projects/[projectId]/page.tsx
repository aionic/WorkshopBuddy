import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Users, Workflow, FileText, ArrowRight, Pencil } from "lucide-react";
import { parseJsonArray, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      _count: { select: { inputs: true, artifacts: true, agentRuns: true } },
      agentRuns: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });
  if (!project) notFound();

  const outcomes = parseJsonArray(project.desiredOutcomes);
  const audience = parseJsonArray(project.targetAudience);
  const artifacts = parseJsonArray(project.selectedArtifacts);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <p className="text-slate-400 text-sm">{project.clientName ?? project.industry}</p>
          {(project.tpid || project.msxOppId) && (
            <p className="text-xs text-slate-500 mt-1">
              {project.tpid && <span>TPID: <span className="text-slate-300">{project.tpid}</span></span>}
              {project.tpid && project.msxOppId && <span className="mx-2">·</span>}
              {project.msxOppId && <span>MSX Opp: <span className="text-slate-300">{project.msxOppId}</span></span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${project.id}/edit`}><Button variant="ghost"><Pencil className="w-4 h-4" /> Edit</Button></Link>
          <Link href={`/projects/${project.id}/workshop`}><Button variant="secondary"><Users className="w-4 h-4" /> Workshop</Button></Link>
          <Link href={`/projects/${project.id}/agents`}><Button variant="secondary"><Workflow className="w-4 h-4" /> Agents</Button></Link>
          <Link href={`/projects/${project.id}/artifacts`}><Button><FileText className="w-4 h-4" /> Artifacts</Button></Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Business problem" />
          <p className="text-slate-200 whitespace-pre-wrap">{project.businessProblem}</p>

          {outcomes.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-white mt-5 mb-2">Desired outcomes</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-200 text-sm">
                {outcomes.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </>
          )}

          {project.timeHorizon && (
            <>
              <h3 className="text-sm font-semibold text-white mt-5 mb-2">Time horizon</h3>
              <p className="text-slate-300 text-sm">{project.timeHorizon}</p>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Project at a glance" />
          <div className="space-y-3 text-sm">
            <Stat label="Inputs" value={project._count.inputs} />
            <Stat label="Artifacts" value={project._count.artifacts} />
            <Stat label="Agent runs" value={project._count.agentRuns} />
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Audience</div>
              <div className="flex flex-wrap gap-1">{audience.map((a) => <Badge key={a}>{a}</Badge>)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Selected artifacts</div>
              <div className="flex flex-wrap gap-1">{artifacts.map((a) => <Badge tone="accent" key={a}>{a}</Badge>)}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent agent runs" />
        {project.agentRuns.length === 0 ? (
          <p className="text-slate-400 text-sm">No runs yet. Add inputs, then start the agent workflow.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {project.agentRuns.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-slate-800 rounded-md px-3 py-2">
                <div>
                  <div className="text-slate-200">{r.status}</div>
                  <div className="text-xs text-slate-500">{formatDate(r.createdAt)}</div>
                </div>
                <Link href={`/projects/${project.id}/agents`} className="text-accent text-xs hover:underline flex items-center gap-1">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

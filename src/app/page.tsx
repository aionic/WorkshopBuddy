import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { isLiveAIConfigured, getAIProvider } from "@/lib/ai/provider";
import { ArrowRight, Plus, Sparkles, Users, FileText, Workflow } from "lucide-react";
import { parseJsonArray, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, inputCount, artifactCount, runCount] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { _count: { select: { inputs: true, artifacts: true, agentRuns: true } } }
    }),
    prisma.workshopInput.count(),
    prisma.artifact.count(),
    prisma.agentRun.count()
  ]);

  const live = isLiveAIConfigured();
  const providerName = getAIProvider().name;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-accent text-xs uppercase tracking-widest mb-2">
              <Sparkles className="w-4 h-4" /> Workshop Buddy
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white max-w-3xl">
              Delivering AI-Powered Solution Design at Enterprise Speed
            </h1>
            <p className="text-slate-300 mt-3 max-w-2xl">
              Turn live discovery conversations into executive-ready solution artifacts in minutes — impact statements,
              roadmaps, briefings, and 90-day plans, all from one guided workshop experience.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/projects/new">
                <Button>
                  <Plus className="w-4 h-4" /> Create New Innovation Project
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="secondary">
                  Browse Projects <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-80">
            <Stat label="Projects" value={projects.length} icon={<FileText className="w-4 h-4" />} />
            <Stat label="Inputs Captured" value={inputCount} icon={<Users className="w-4 h-4" />} />
            <Stat label="Agent Runs" value={runCount} icon={<Workflow className="w-4 h-4" />} />
            <Stat label="Artifacts" value={artifactCount} icon={<Sparkles className="w-4 h-4" />} />
          </div>
        </div>
      </Card>

      {!live ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <Badge tone="warn">Demo mode</Badge>
            <div className="text-sm text-amber-200/90">
              No AI provider is configured. The studio is running with deterministic demo content so you can explore the
              seeded OCR-to-GenAI project end-to-end. Set <code>AI_PROVIDER=azure_foundry</code> plus
              <code> AZURE_FOUNDRY_RESPONSES_ENDPOINT</code> and <code>AZURE_FOUNDRY_MODEL</code> in <code>.env</code>,
              run <code>az login</code>, then restart the dev server to enable live GPT-5 generation.
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <Badge tone="success">Live AI</Badge>
            <div className="text-sm text-emerald-100/90">
              Connected to AI provider <code>{providerName}</code>
              {providerName === "azure_foundry" && process.env.AZURE_FOUNDRY_MODEL
                ? <> using model <code>{process.env.AZURE_FOUNDRY_MODEL}</code> via Entra ID (no API key).</>
                : <>.</>}
            </div>
          </div>
        </Card>
      )}

      <div>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Recent projects</h2>
          <Link href="/projects" className="text-sm text-accent hover:underline">View all</Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <p className="text-slate-300">No projects yet. Create one to begin.</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Card key={p.id} className="hover:border-accent/50 transition">
                <CardHeader title={p.name} subtitle={p.clientName ?? p.industry ?? "Innovation project"} />
                <p className="text-sm text-slate-300 line-clamp-3">{p.businessProblem}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge tone="accent">{p._count.inputs} inputs</Badge>
                  <Badge>{p._count.artifacts} artifacts</Badge>
                  <Badge>{p._count.agentRuns} runs</Badge>
                  {parseJsonArray(p.targetAudience).slice(0, 2).map((a) => (
                    <Badge key={a}>{a}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Updated {formatDate(p.updatedAt)}</span>
                  <div className="flex items-center gap-2">
                    <DeleteProjectButton projectId={p.id} projectName={p.name} />
                    <Link href={`/projects/${p.id}`}>
                      <Button variant="ghost">Open <ArrowRight className="w-4 h-4" /></Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-ink-800/60 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wide">{icon}{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

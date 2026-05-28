"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Badge, Button, Input } from "@/components/ui";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ArrowRight, Search, Pencil } from "lucide-react";
import { parseJsonArray, formatDate } from "@/lib/utils";

export type ProjectListItem = {
  id: string;
  name: string;
  clientName: string | null;
  tpid: string | null;
  msxOppId: string | null;
  industry: string | null;
  businessProblem: string;
  selectedArtifacts: string;
  updatedAt: string;
  _count: { inputs: number; artifacts: number; agentRuns: number };
};

export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const name = p.name.toLowerCase();
      const customer = (p.clientName ?? "").toLowerCase();
      return name.includes(q) || customer.includes(q);
    });
  }, [projects, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by project name or customer name..."
          className="pl-9"
          aria-label="Search projects"
        />
      </div>

      {projects.length === 0 ? (
        <Card><p className="text-slate-300">No projects yet.</p></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-slate-300">
            No projects match <span className="text-white font-medium">&ldquo;{query}&rdquo;</span>.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:border-accent/50 transition">
              <CardHeader title={p.name} subtitle={p.clientName ?? p.industry ?? ""} />
              {(p.tpid || p.msxOppId) && (
                <div className="flex flex-wrap gap-2 -mt-1 mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                  {p.tpid && <span>TPID: <span className="text-slate-300 normal-case">{p.tpid}</span></span>}
                  {p.msxOppId && <span>MSX: <span className="text-slate-300 normal-case">{p.msxOppId}</span></span>}
                </div>
              )}
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
                  <Link href={`/projects/${p.id}/edit`}>
                    <Button variant="ghost"><Pencil className="w-4 h-4" /> Edit</Button>
                  </Link>
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

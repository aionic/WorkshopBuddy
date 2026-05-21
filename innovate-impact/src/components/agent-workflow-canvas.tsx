"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Button, Badge, Textarea, Label } from "@/components/ui";
import { Play, RotateCcw, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const AGENT_NAMES = [
  "Intake Clarification Agent",
  "Pain Point Synthesis Agent",
  "Business Impact Agent",
  "Solution Concept Agent",
  "Architecture and Solution Map Agent",
  "KPI and Value Agent",
  "Roadmap Agent",
  "Executive Storytelling Agent",
  "Artifact Packager Agent",
  "Application Spec Agent",
  "Review and Quality Agent"
];

const ARTIFACT_OPTIONS = [
  "Impact Statement",
  "Executive Briefing Deck",
  "Solution Map",
  "90-Day Execution Plan",
  "Trends White Paper",
  "KPI Framework",
  "Application Spec"
];

type AgentLine = {
  name: string;
  status: "Not Started" | "Running" | "Completed" | "Failed";
  summary?: string;
  usedLLM?: boolean;
  llmError?: string;
  durationMs?: number;
};
type Run = { id: string; status: string; createdAt: string; outputJson: string | null };

export function AgentWorkflowCanvas({
  project,
  liveAI
}: {
  project: { id: string; name: string; inputCount: number; selectedArtifacts: string[]; recentRuns: Run[] };
  liveAI: boolean;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentLine[]>(AGENT_NAMES.map((n) => ({ name: n, status: "Not Started" })));
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [review, setReview] = useState<{ qualityScore: number; missingSections: string[]; suggestedEdits: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [selected, setSelected] = useState<string[]>(project.selectedArtifacts);
  const [savingSel, setSavingSel] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If the most recent run is still Running when the page loads, resume polling.
  useEffect(() => {
    const latest = project.recentRuns?.[0];
    if (latest && latest.status === "Running") {
      setRunning(true);
      setAgents(AGENT_NAMES.map((n) => ({ name: n, status: "Running" })));
      setActiveRunId(latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the active run until it completes. Survives client navigation away and
  // back because the run row is the source of truth in the database.
  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/projects/${project.id}/agent-runs/${activeRunId}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        if (Array.isArray(data.agents) && data.agents.length > 0) {
          const map: Record<string, AgentLine> = {};
          // While the run is still in progress, agents not yet reported are
          // "Running"; once it terminates, anything still unreported was
          // intentionally skipped (e.g., Application Spec Agent when its
          // artifact wasn't requested) and should render as Not Started.
          const inFlight = data.status === "Running";
          for (const n of AGENT_NAMES) map[n] = { name: n, status: inFlight ? "Running" : "Not Started" };
          for (const a of data.agents as AgentLine[]) {
            map[a.name] = {
              name: a.name,
              status: a.status === "Failed" ? "Failed" : "Completed",
              summary: a.summary,
              usedLLM: a.usedLLM,
              llmError: a.llmError,
              durationMs: a.durationMs
            };
          }
          setAgents(AGENT_NAMES.map((n) => map[n]));
        }
        if (data.status !== "Running") {
          setReview(data.review ?? null);
          if (data.status === "Failed") setError(data.error ?? "Run failed");
          setRunning(false);
          setActiveRunId(null);
          router.refresh();
        }
      } catch {
        // transient network blip — keep polling
      }
    };
    void tick();
    pollRef.current = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeRunId, project.id, router]);

  async function toggleArtifact(name: string) {
    const next = selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name];
    setSelected(next);
    setSavingSel(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedArtifacts: next })
      });
    } finally {
      setSavingSel(false);
    }
  }

  async function runFull() {
    setError(null);
    setReview(null);
    setRunning(true);
    setAgents(AGENT_NAMES.map((n) => ({ name: n, status: "Running" })));
    try {
      const res = await fetch(`/api/projects/${project.id}/agent-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full_workflow", customInstructions, artifactTypes: selected })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Run failed");
      const data = await res.json();
      // Server returns 202 with { runId, status: "Running" }. The useEffect above
      // takes over and polls until the run completes.
      if (data.runId) setActiveRunId(data.runId);
    } catch (e) {
      setError((e as Error).message);
      setAgents((prev) => prev.map((a) => (a.status === "Running" ? { ...a, status: "Failed" } : a)));
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${project.id}`} className="text-xs text-accent hover:underline">← Back to project</Link>
          <h1 className="text-2xl font-bold text-white">Agent Workflow</h1>
          <p className="text-slate-400 text-sm">AI generates first drafts. Human review and approval remain required before client use.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${project.id}/artifacts`}>
            <Button variant="secondary">View Artifacts <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Workflow controls"
          subtitle={liveAI ? "Live AI provider configured" : "Running in deterministic demo mode (no AI key configured)"}
          action={<Badge tone={liveAI ? "success" : "warn"}>{liveAI ? "Live AI" : "Demo mode"}</Badge>}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-300">Inputs available: <span className="text-white font-semibold">{project.inputCount}</span></div>
          <div className="text-sm text-slate-300">Artifacts requested: <span className="text-white font-semibold">{selected.length}</span></div>
          {savingSel && <span className="text-xs text-slate-500">Saving…</span>}
        </div>
        <div className="mt-4">
          <Label>Artifacts to generate</Label>
          <div className="flex flex-wrap gap-2">
            {ARTIFACT_OPTIONS.map((a) => {
              const on = selected.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArtifact(a)}
                  disabled={running}
                  className={`px-2 py-1 rounded border text-xs transition ${on ? "bg-accent/15 border-accent/40 text-accent" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"}`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1">These are the deliverables the Artifact Packager Agent will produce. Toggling persists immediately.</p>
        </div>
        <div className="mt-4">
          <Label>Custom instructions (optional)</Label>
          <Textarea rows={2} value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="e.g. emphasize executive funding decision and speed to value" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={runFull} disabled={running || project.inputCount === 0 || selected.length === 0}>
            {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Play className="w-4 h-4" /> Run Full Workflow</>}
          </Button>
          <Button variant="secondary" onClick={() => { setAgents(AGENT_NAMES.map((n) => ({ name: n, status: "Not Started" }))); setReview(null); setError(null); }}>
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>
        {project.inputCount === 0 && (
          <div className="mt-3 text-sm text-amber-300">Add at least one workshop input before running the workflow.</div>
        )}
        {selected.length === 0 && (
          <div className="mt-3 text-sm text-amber-300">Select at least one artifact to generate.</div>
        )}
        <div className="mt-3 text-xs text-slate-500">
          Re-running this workflow will create a new version of each existing artifact (previous versions are preserved in history).
        </div>
        {running && (
          <div className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent flex items-start gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Workflow running in the background.</div>
              <div className="text-accent/80">
                A full run typically takes 4–10 minutes. You can safely leave this page or close the tab — progress is saved server-side. When you return, polling resumes automatically.
              </div>
            </div>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-red-300">Error: {error}</div>}
      </Card>

      <Card>
        <CardHeader title="Agents" subtitle="Status flows top to bottom" />
        <div className="grid md:grid-cols-2 gap-3">
          {agents.map((a) => (
            <div key={a.name} className="rounded-lg border border-slate-800 bg-ink-800/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-white">{a.name}</div>
                <div className="flex items-center gap-1.5">
                  {a.usedLLM === true && <Badge tone="accent">LLM</Badge>}
                  {a.usedLLM === false && a.status !== "Not Started" && a.status !== "Running" && (
                    <Badge tone="warn">Fallback</Badge>
                  )}
                  {typeof a.durationMs === "number" && a.durationMs > 0 && (
                    <span className="text-[10px] text-slate-500">{(a.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  <StatusBadge status={a.status} />
                </div>
              </div>
              {a.summary && <p className="text-xs text-slate-400 mt-1">{a.summary}</p>}
              {a.llmError && (
                <p className="text-xs text-amber-300 mt-1">
                  <AlertTriangle className="inline w-3 h-3 mr-1" />
                  LLM fell back: {a.llmError}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {review && (
        <Card>
          <CardHeader title="Review & quality" subtitle="Output of the Review and Quality Agent" />
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-bold text-accent">{review.qualityScore}</div>
            <div className="text-sm text-slate-400">/ 100 quality score</div>
          </div>
          {review.missingSections.length > 0 && (
            <div className="text-sm text-amber-300"><AlertTriangle className="inline w-4 h-4 mr-1" /> Missing: {review.missingSections.join("; ")}</div>
          )}
          {review.suggestedEdits.length > 0 && (
            <div className="text-sm text-slate-300 mt-1">Suggestions: {review.suggestedEdits.join("; ")}</div>
          )}
          {review.missingSections.length === 0 && review.suggestedEdits.length === 0 && (
            <div className="text-sm text-emerald-300"><CheckCircle2 className="inline w-4 h-4 mr-1" /> All artifacts look complete.</div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Activity log" />
        {project.recentRuns.length === 0 ? (
          <p className="text-slate-400 text-sm">No previous runs.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {project.recentRuns.map((r) => (
              <div key={r.id} className="border border-slate-800 rounded-md px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200">{r.status}</span>
                  <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: AgentLine["status"] }) {
  if (status === "Completed") return <Badge tone="success">Completed</Badge>;
  if (status === "Running") return <Badge tone="accent">Running</Badge>;
  if (status === "Failed") return <Badge tone="danger">Failed</Badge>;
  return <Badge>Not started</Badge>;
}

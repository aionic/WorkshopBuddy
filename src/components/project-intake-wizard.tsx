"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Input, Textarea, Label, Button, Badge } from "@/components/ui";

const ARTIFACT_OPTIONS = [
  "Impact Statement",
  "Executive Briefing Deck",
  "Solution Map",
  "90-Day Execution Plan",
  "Trends White Paper",
  "KPI Framework",
  "Application Spec"
];

const AUDIENCE_OPTIONS = ["CIO", "CTO", "CFO", "Operations Executive", "Chief Customer Officer", "Compliance"];

export type ProjectFormInitial = {
  id?: string;
  name?: string;
  clientName?: string | null;
  tpid?: string | null;
  msxOppId?: string | null;
  industry?: string | null;
  businessProblem?: string;
  desiredOutcomes?: string[];
  targetAudience?: string[];
  selectedArtifacts?: string[];
  timeHorizon?: string | null;
};

type Props = {
  mode?: "create" | "edit";
  initial?: ProjectFormInitial;
};

export function ProjectIntakeWizard({ mode = "create", initial }: Props = {}) {
  const router = useRouter();
  const isEdit = mode === "edit" && !!initial?.id;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    clientName: initial?.clientName ?? "",
    tpid: initial?.tpid ?? "",
    msxOppId: initial?.msxOppId ?? "",
    industry: initial?.industry ?? "",
    businessProblem: initial?.businessProblem ?? "",
    desiredOutcomes: (initial?.desiredOutcomes ?? []).join("\n"),
    targetAudience: initial?.targetAudience ?? ["CIO", "CTO", "CFO"],
    selectedArtifacts:
      initial?.selectedArtifacts ?? ["Impact Statement", "Executive Briefing Deck", "Solution Map", "90-Day Execution Plan"],
    timeHorizon: initial?.timeHorizon ?? "90 days for pilot planning; 6-8 months for full modernization"
  });

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  async function submit() {
    setError(null);
    if (!form.name || !form.businessProblem) {
      setError("Project name and business problem are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        clientName: form.clientName.trim() || null,
        tpid: form.tpid.trim() || null,
        msxOppId: form.msxOppId.trim() || null,
        industry: form.industry.trim() || null,
        timeHorizon: form.timeHorizon.trim() || null,
        desiredOutcomes: form.desiredOutcomes.split("\n").map((s) => s.trim()).filter(Boolean)
      };
      const url = isEdit ? `/api/projects/${initial!.id}` : "/api/projects";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `Failed to ${isEdit ? "update" : "create"} project`);
      const project = await res.json();
      if (isEdit) {
        router.push(`/projects/${project.id}`);
        router.refresh();
      } else {
        router.push(`/projects/${project.id}/workshop`);
      }
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader title={isEdit ? "Edit project" : "Project intake"} subtitle="Required fields marked with *" />
      {error && (
        <div className="mb-4 p-3 rounded border border-red-500/40 bg-red-500/10 text-sm text-red-200">{error}</div>
      )}
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Project name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="OCR to GenAI Document Intelligence" />
          </div>
          <div>
            <Label>Customer name</Label>
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Contoso Logistics" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Industry</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Transportation and Logistics" />
          </div>
          <div>
            <Label>TPID #</Label>
            <Input value={form.tpid} onChange={(e) => setForm({ ...form, tpid: e.target.value })} placeholder="e.g. 1234567" />
          </div>
          <div>
            <Label>MSX Opp ID</Label>
            <Input value={form.msxOppId} onChange={(e) => setForm({ ...form, msxOppId: e.target.value })} placeholder="e.g. 7-ABCDEFGH" />
          </div>
        </div>
        <div>
          <Label>Business problem *</Label>
          <Textarea rows={4} value={form.businessProblem} onChange={(e) => setForm({ ...form, businessProblem: e.target.value })} placeholder="Describe the problem in business terms..." />
        </div>
        <div>
          <Label>Desired outcomes (one per line)</Label>
          <Textarea rows={4} value={form.desiredOutcomes} onChange={(e) => setForm({ ...form, desiredOutcomes: e.target.value })} placeholder={"Reduce cost per document\nIncrease straight-through-processing"} />
        </div>
        <div>
          <Label>Target audience</Label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setForm({ ...form, targetAudience: toggle(form.targetAudience, a) })}
                className={`px-2 py-1 rounded border text-xs ${form.targetAudience.includes(a) ? "bg-accent/15 border-accent/40 text-accent" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Time horizon</Label>
          <Input value={form.timeHorizon} onChange={(e) => setForm({ ...form, timeHorizon: e.target.value })} />
        </div>
        <div>
          <Label>Artifacts to generate</Label>
          <div className="flex flex-wrap gap-2">
            {ARTIFACT_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setForm({ ...form, selectedArtifacts: toggle(form.selectedArtifacts, a) })}
                className={`px-2 py-1 rounded border text-xs ${form.selectedArtifacts.includes(a) ? "bg-accent/15 border-accent/40 text-accent" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting
              ? isEdit ? "Saving..." : "Creating..."
              : isEdit ? "Save changes" : "Create project & open workshop"}
          </Button>
          {isEdit && (
            <Button variant="ghost" onClick={() => router.back()} disabled={submitting}>Cancel</Button>
          )}
          {!isEdit && <Badge tone="accent">Step 1 of 3</Badge>}
        </div>
      </div>
    </Card>
  );
}

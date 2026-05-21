"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardHeader, Badge, Button, Select, Textarea, Label } from "@/components/ui";
import { ThumbsUp, Trash2, Workflow, ArrowRight, Pencil, Check, X } from "lucide-react";

const CATEGORIES = [
  "Pain Point", "Business Outcome", "Process Bottleneck", "Customer Impact",
  "Operational Impact", "Technical Constraint", "Solution Idea", "KPI / Metric",
  "Risk / Dependency", "Cost of Inaction"
];
const PERSONAS = ["Operations", "IT", "Finance", "Compliance", "Customer Experience", "Sales", "Marketing", "Engineering", "Executive"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

type WorkshopInput = {
  id: string; category: string; persona: string | null; priority: string;
  content: string; submittedBy: string | null; votes: number; createdAt: string;
};

type EditDraft = { category: string; persona: string; priority: string; content: string };

export function WorkshopBoard({ project }: { project: { id: string; name: string; businessProblem: string; inputs: WorkshopInput[] } }) {
  const router = useRouter();
  const [inputs, setInputs] = useState<WorkshopInput[]>(project.inputs);
  const [draft, setDraft] = useState({ category: "Pain Point", persona: "Operations", priority: "Medium", content: "" });
  const [filter, setFilter] = useState<string>("All");
  const [busy, setBusy] = useState(false);
  const [facilitatorNotes, setFacilitatorNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ category: "Pain Point", persona: "Operations", priority: "Medium", content: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = useMemo(() => filter === "All" ? inputs : inputs.filter((i) => i.category === filter), [inputs, filter]);

  async function add() {
    if (!draft.content.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${project.id}/inputs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    if (res.ok) {
      const created = await res.json();
      setInputs([created, ...inputs]);
      setDraft({ ...draft, content: "" });
    }
    setBusy(false);
  }

  async function upvote(id: string) {
    const res = await fetch(`/api/inputs/${id}/vote`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setInputs((x) => x.map((i) => (i.id === id ? { ...i, votes: updated.votes } : i)));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this input?")) return;
    const res = await fetch(`/api/inputs/${id}`, { method: "DELETE" });
    if (res.ok) setInputs((x) => x.filter((i) => i.id !== id));
  }

  function startEdit(i: WorkshopInput) {
    setEditingId(i.id);
    setEditDraft({
      category: i.category,
      persona: i.persona ?? "Operations",
      priority: i.priority,
      content: i.content
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft.content.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/inputs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft)
    });
    if (res.ok) {
      const updated = await res.json();
      setInputs((x) => x.map((i) => (i.id === id ? { ...i, ...updated } : i)));
      setEditingId(null);
    }
    setSavingEdit(false);
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of inputs) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, [inputs]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${project.id}`} className="text-xs text-accent hover:underline">← Back to project</Link>
          <h1 className="text-2xl font-bold text-white">Workshop Studio</h1>
          <p className="text-slate-400 text-sm">Capture stakeholder inputs in real time. AI will synthesize them.</p>
        </div>
        <Link href={`/projects/${project.id}/agents`}>
          <Button><Workflow className="w-4 h-4" /> Continue to Agents <ArrowRight className="w-4 h-4" /></Button>
        </Link>
      </div>

      <Card>
        <CardHeader title={project.name} subtitle="Project context" />
        <p className="text-slate-200 text-sm whitespace-pre-wrap">{project.businessProblem}</p>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Add input" subtitle="Capture pain points, outcomes, ideas, risks…" />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Category</Label>
                <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Persona</Label>
                <Select value={draft.persona} onChange={(e) => setDraft({ ...draft, persona: e.target.value })}>
                  {PERSONAS.map((p) => <option key={p}>{p}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea rows={4} placeholder="Type the stakeholder input..." value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            </div>
            <Button onClick={add} disabled={busy || !draft.content.trim()}>{busy ? "Adding..." : "Add input"}</Button>
          </div>

          <div className="mt-6">
            <Label>Facilitator notes</Label>
            <Textarea rows={4} value={facilitatorNotes} onChange={(e) => setFacilitatorNotes(e.target.value)} placeholder="Private notes (not persisted in this demo)..." />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={`Input board (${inputs.length})`}
            subtitle="Grouped, filterable, votable, editable"
            action={
              <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option>All</option>
                {CATEGORIES.map((c) => <option key={c}>{c}{counts[c] ? ` (${counts[c]})` : ""}</option>)}
              </Select>
            }
          />
          {filtered.length === 0 ? (
            <p className="text-slate-400 text-sm">No inputs yet. Add the first one to start the workshop.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((i) => (
                <div key={i.id} className="rounded-lg border border-slate-800 bg-ink-800/60 p-3">
                  {editingId === i.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Category</Label>
                          <Select value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>Persona</Label>
                          <Select value={editDraft.persona} onChange={(e) => setEditDraft({ ...editDraft, persona: e.target.value })}>
                            {PERSONAS.map((p) => <option key={p}>{p}</option>)}
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select value={editDraft.priority} onChange={(e) => setEditDraft({ ...editDraft, priority: e.target.value })}>
                          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label>Content</Label>
                        <Textarea rows={3} value={editDraft.content} onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })} />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={cancelEdit} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/60 text-slate-300">
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <button onClick={() => saveEdit(i.id)} disabled={savingEdit || !editDraft.content.trim()} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent disabled:opacity-50">
                          <Check className="w-3 h-3" /> {savingEdit ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone="accent">{i.category}</Badge>
                          {i.persona && <Badge>{i.persona}</Badge>}
                          <Badge tone={i.priority === "Critical" ? "danger" : i.priority === "High" ? "warn" : "default"}>{i.priority}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => upvote(i.id)} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700/60 text-slate-300">
                            <ThumbsUp className="w-3 h-3" /> {i.votes}
                          </button>
                          <button onClick={() => startEdit(i)} title="Edit" className="text-xs p-1 rounded hover:bg-slate-700/60 text-slate-300">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => remove(i.id)} title="Delete" className="text-xs p-1 rounded hover:bg-red-500/20 text-red-300">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-100 whitespace-pre-wrap">{i.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => router.refresh()}>Refresh</Button>
            <Link href={`/projects/${project.id}/agents`}><Button>Run AI workflow <ArrowRight className="w-4 h-4" /></Button></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

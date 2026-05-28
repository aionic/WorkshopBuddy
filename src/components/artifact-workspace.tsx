"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardHeader, Badge, Button, Textarea, Label, Input } from "@/components/ui";
import { Download, RotateCw, Save, FileType2 } from "lucide-react";

type ArtifactVersion = { id: string; version: number; createdAt: string; markdown: string | null };
type Artifact = {
  id: string; artifactType: string; title: string; status: string; currentVersion: number;
  markdown: string | null; contentJson: string; updatedAt: string; versions: ArtifactVersion[];
};

function renderMarkdownToHtml(md: string): string {
  // Lightweight markdown renderer for preview only.
  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHeaderRendered = false;

  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const closeTable = () => { if (inTable) { out.push("</tbody></table>"); inTable = false; tableHeaderRendered = false; } };

  for (const raw of lines) {
    const line = raw;
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!inTable) { out.push('<table><thead>'); inTable = true; tableHeaderRendered = false; }
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^[-: ]+$/.test(c))) { out.push("</thead><tbody>"); tableHeaderRendered = true; continue; }
      const tag = tableHeaderRendered ? "td" : "th";
      out.push("<tr>" + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("") + "</tr>");
      continue;
    } else closeTable();

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    } else closeList();

    if (line.startsWith("### ")) { out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## ")) { out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# ")) { out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (/^\s*---\s*$/.test(line)) { out.push("<hr/>"); continue; }
    if (line.trim() === "") { out.push(""); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeTable();
  function inline(s: string) {
    return escape(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  }
  return out.join("\n");
}

export function ArtifactWorkspace({ project }: { project: { id: string; name: string; artifacts: Artifact[] } }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>(project.artifacts);
  const [activeId, setActiveId] = useState<string | null>(project.artifacts[0]?.id ?? null);
  const active = artifacts.find((a) => a.id === activeId) ?? null;
  const [draft, setDraft] = useState<string>(project.artifacts[0]?.markdown ?? "");
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [busy, setBusy] = useState<"save" | "regen" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m: Record<string, Artifact[]> = {};
    for (const a of artifacts) (m[a.artifactType] ||= []).push(a);
    return m;
  }, [artifacts]);

  function selectArtifact(a: Artifact) {
    setActiveId(a.id);
    setDraft(a.markdown ?? "");
    setError(null);
    setRevisionInstructions("");
  }

  async function saveEdits() {
    if (!active) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: draft })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      const updated: Artifact = await res.json();
      setArtifacts((arr) => arr.map((a) => (a.id === updated.id ? { ...a, ...updated, versions: a.versions } : a)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    if (!active) return;
    setBusy("regen");
    setError(null);
    try {
      const res = await fetch(`/api/artifacts/${active.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionInstructions })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Regenerate failed");
      const updated: Artifact = await res.json();
      setArtifacts((arr) => arr.map((a) => (a.id === updated.id ? { ...a, ...updated, versions: a.versions } : a)));
      setDraft(updated.markdown ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${project.id}`} className="text-xs text-accent hover:underline">← Back to project</Link>
          <h1 className="text-2xl font-bold text-white">Artifacts</h1>
          <p className="text-slate-400 text-sm">Preview, edit, regenerate, approve, and download AI-drafted work products.</p>
        </div>
        <Link href={`/projects/${project.id}/agents`}><Button variant="secondary">Back to Agents</Button></Link>
      </div>

      {artifacts.length === 0 ? (
        <Card>
          <p className="text-slate-300">No artifacts yet. Run the agent workflow to generate them.</p>
          <div className="mt-3">
            <Link href={`/projects/${project.id}/agents`}><Button>Go to Agent Workflow</Button></Link>
          </div>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-3">
            <CardHeader title="Artifact list" subtitle={`${artifacts.length} total`} />
            <div className="space-y-4">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{type}</div>
                  <div className="space-y-1">
                    {items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => selectArtifact(a)}
                        className={`w-full text-left px-2 py-2 rounded text-sm border ${a.id === activeId ? "border-accent/40 bg-accent/10 text-accent" : "border-slate-800 hover:bg-slate-800/40 text-slate-200"}`}
                      >
                        <div className="font-medium truncate">{a.title}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          v{a.currentVersion} <Badge tone={a.status === "Approved" ? "success" : "default"}>{a.status}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-9 space-y-4">
            {active && (
              <>
                <Card>
                  <CardHeader
                    title={active.title}
                    subtitle={`${active.artifactType} • v${active.currentVersion} • ${active.status}`}
                    action={
                      <div className="flex flex-wrap gap-2">
                        <a href={`/api/artifacts/${active.id}/download?format=markdown`}>
                          <Button variant="secondary"><Download className="w-4 h-4" /> .md</Button>
                        </a>
                        {active.artifactType !== "Executive Briefing Deck" && (
                          <a href={`/api/artifacts/${active.id}/download?format=docx`}>
                            <Button variant="secondary"><FileType2 className="w-4 h-4" /> .docx</Button>
                          </a>
                        )}
                        {active.artifactType === "Executive Briefing Deck" && (
                          <a href={`/api/artifacts/${active.id}/download?format=pptx`}>
                            <Button><Download className="w-4 h-4" /> .pptx</Button>
                          </a>
                        )}
                      </div>
                    }
                  />
                  <div className="prose-md max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(draft || active.markdown || "") }} />
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader title="Edit markdown" subtitle="Changes create a new version" />
                    <Textarea rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <div className="mt-3 flex gap-2">
                      <Button onClick={saveEdits} disabled={busy === "save"}>
                        <Save className="w-4 h-4" /> {busy === "save" ? "Saving..." : "Save edits"}
                      </Button>
                      <Button variant="secondary" onClick={() => setDraft(active.markdown ?? "")}>Revert</Button>
                    </div>
                  </Card>

                  <Card>
                    <CardHeader title="Regenerate" subtitle="Send instructions to the AI workflow" />
                    <Label>Revision instructions</Label>
                    <Textarea rows={6} value={revisionInstructions} onChange={(e) => setRevisionInstructions(e.target.value)} placeholder="e.g. shorten the executive summary; add more emphasis on STP gains" />
                    <div className="mt-3 flex gap-2">
                      <Button onClick={regenerate} disabled={busy === "regen"}>
                        <RotateCw className={`w-4 h-4 ${busy === "regen" ? "animate-spin" : ""}`} /> {busy === "regen" ? "Regenerating..." : "Regenerate artifact"}
                      </Button>
                    </div>
                    <div className="mt-4">
                      <Label>Status</Label>
                      <div className="flex gap-2">
                        {["Draft", "In Review", "Approved", "Archived"].map((s) => (
                          <button
                            key={s}
                            onClick={async () => {
                              const res = await fetch(`/api/artifacts/${active.id}`, {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: s })
                              });
                              if (res.ok) {
                                const upd: Artifact = await res.json();
                                setArtifacts((arr) => arr.map((a) => (a.id === upd.id ? { ...a, ...upd, versions: a.versions } : a)));
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded border ${active.status === s ? "border-accent/40 bg-accent/10 text-accent" : "border-slate-700 text-slate-300 hover:bg-slate-800/60"}`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>

                <Card>
                  <CardHeader title="Version history" subtitle={`${active.versions.length} prior versions`} />
                  {active.versions.length === 0 ? (
                    <p className="text-slate-400 text-sm">No prior versions yet. Edits and regenerations will appear here.</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {active.versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between border border-slate-800 rounded px-3 py-2">
                          <span>v{v.version}</span>
                          <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {error && <Card className="border-red-500/30"><p className="text-red-300 text-sm">{error}</p></Card>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

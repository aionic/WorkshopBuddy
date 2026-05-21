"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Sparkles, Upload, X, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Badge, Button, Label, Select, Textarea, Input } from "@/components/ui";
import { CATEGORIES, PERSONAS, PRIORITIES, type Category, type Persona, type Priority } from "@/lib/workshop-enums";

export type CandidateCard = {
  category: Category;
  persona: Persona | null;
  priority: Priority;
  content: string;
  evidence: string;
  confidence: number;
  source: "ai" | "demo";
};

type ExtractResponse = {
  ingestId: string;
  cards: CandidateCard[];
  usedLLM: boolean;
  llmError?: string;
  format: string;
  charLength: number;
  durationMs: number;
};

type Tab = "paste" | "upload";

export function TranscriptImportModal({
  projectId,
  open,
  onClose,
  onCommitted,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCommitted: (count: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("paste");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [hints, setHints] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [rows, setRows] = useState<Array<CandidateCard & { id: string; checked: boolean }>>([]);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !extracting && !committing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, extracting, committing]);

  // Reset state every time the modal opens.
  useEffect(() => {
    if (open) {
      setTab("paste");
      setPasted("");
      setFile(null);
      setHints("");
      setError(null);
      setExtract(null);
      setRows([]);
      setFilterCategory("All");
    }
  }, [open]);

  const filteredRows = useMemo(() => {
    if (filterCategory === "All") return rows;
    return rows.filter((r) => r.category === filterCategory);
  }, [rows, filterCategory]);

  const selectedCount = rows.filter((r) => r.checked).length;

  async function runExtract() {
    setError(null);
    setExtract(null);
    setRows([]);

    if (tab === "paste" && pasted.trim().length < 60) {
      setError("Paste at least a paragraph or two of transcript before extracting.");
      return;
    }
    if (tab === "upload" && !file) {
      setError("Choose a file to upload.");
      return;
    }

    setExtracting(true);
    try {
      let res: Response;
      if (tab === "upload" && file) {
        const fd = new FormData();
        fd.append("file", file);
        if (hints.trim()) fd.append("hints", hints.trim());
        res = await fetch(`/api/projects/${projectId}/transcripts/extract`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/projects/${projectId}/transcripts/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasted, hints: hints.trim() || undefined }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setError(err.error ?? `Request failed (${res.status})`);
        return;
      }

      const data = (await res.json()) as ExtractResponse;
      setExtract(data);
      setRows(
        data.cards.map((c, i) => ({
          ...c,
          id: `${i}-${c.category}-${c.content.slice(0, 24)}`,
          checked: true,
        })),
      );
      if (data.cards.length === 0) {
        setError("The extractor did not find any workshop cards in this transcript. Try adding more context or adjusting the hints.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function commit() {
    const items = rows
      .filter((r) => r.checked && r.content.trim())
      .map((r) => ({
        category: r.category,
        persona: r.persona,
        priority: r.priority,
        content: r.content.trim(),
        submittedBy: "Transcript Intake",
      }));

    if (items.length === 0) {
      setError("Select at least one card to add.");
      return;
    }

    setCommitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/inputs/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, transcriptIngestId: extract?.ingestId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setError(err.error ?? `Request failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { created: number };
      onCommitted(data.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add inputs");
    } finally {
      setCommitting(false);
    }
  }

  function updateRow(id: string, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function dropRow(id: string) {
    setRows((current) => current.filter((r) => r.id !== id));
  }

  function selectAll(value: boolean) {
    setRows((current) => current.map((r) => ({ ...r, checked: value })));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import transcript"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-5xl my-8 rounded-xl border border-slate-700 bg-ink-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" /> Import from transcript
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Paste a transcript or upload a file. The Transcript Intake Agent will suggest
              Workshop Board cards for you to review and approve.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={extracting || committing}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!extract && (
            <>
              <div className="flex gap-1 border-b border-slate-800">
                <TabButton active={tab === "paste"} onClick={() => setTab("paste")} icon={<FileText className="w-4 h-4" />}>
                  Paste text
                </TabButton>
                <TabButton active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="w-4 h-4" />}>
                  Upload file
                </TabButton>
              </div>

              {tab === "paste" ? (
                <div>
                  <Label>Transcript text</Label>
                  <Textarea
                    rows={12}
                    placeholder="Paste a Teams transcript, Word doc text, or raw discovery notes here…"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {pasted.length.toLocaleString()} characters · best results with at least a few minutes of conversation.
                  </p>
                </div>
              ) : (
                <div>
                  <Label>Transcript file</Label>
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.vtt,.srt,.docx,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-200 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-100 hover:file:bg-slate-700"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Supported: .txt, .md, .vtt, .srt, .docx, .pdf · max 10 MB.
                  </p>
                  {file && (
                    <p className="text-xs text-slate-400 mt-1">
                      Selected: <span className="text-slate-200">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Facilitator hints (optional)</Label>
                <Input
                  placeholder='e.g. "Audience is the CFO; focus on cost reduction"'
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={extracting}>
                  Cancel
                </Button>
                <Button onClick={runExtract} disabled={extracting}>
                  {extracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Extracting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Extract candidate cards
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {extract && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={extract.usedLLM ? "success" : "warn"}>
                  {extract.usedLLM ? "Live AI" : "Demo extractor"}
                </Badge>
                <Badge tone="default">{extract.format}</Badge>
                <Badge tone="default">{extract.charLength.toLocaleString()} chars</Badge>
                <Badge tone="default">{(extract.durationMs / 1000).toFixed(1)}s</Badge>
                <span className="text-slate-400">
                  {rows.length} candidate cards · {selectedCount} selected
                </span>
              </div>

              {extract.llmError && (
                <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>Live AI fell back to the demo extractor: {extract.llmError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => selectAll(true)}>
                  Select all
                </Button>
                <Button variant="secondary" onClick={() => selectAll(false)}>
                  Deselect all
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Label>
                    <span className="sr-only">Filter</span>
                  </Label>
                  <Select
                    className="w-48"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option>All</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-2">
                {filteredRows.length === 0 && (
                  <p className="text-sm text-slate-400 p-4 text-center">
                    No candidate cards match this filter.
                  </p>
                )}
                {filteredRows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-lg border p-3 transition ${
                      row.checked
                        ? "border-slate-700 bg-ink-800/60"
                        : "border-slate-800 bg-ink-900/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={(e) => updateRow(row.id, { checked: e.target.checked })}
                        className="mt-1.5 accent-cyan-400"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Select
                            value={row.category}
                            onChange={(e) => updateRow(row.id, { category: e.target.value as Category })}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </Select>
                          <Select
                            value={row.persona ?? ""}
                            onChange={(e) =>
                              updateRow(row.id, {
                                persona: e.target.value ? (e.target.value as Persona) : null,
                              })
                            }
                          >
                            <option value="">(no persona)</option>
                            {PERSONAS.map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </Select>
                          <Select
                            value={row.priority}
                            onChange={(e) => updateRow(row.id, { priority: e.target.value as Priority })}
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </Select>
                        </div>
                        <Textarea
                          rows={2}
                          value={row.content}
                          onChange={(e) => updateRow(row.id, { content: e.target.value })}
                        />
                        {row.evidence && (
                          <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2">
                            “{row.evidence}”
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            confidence {(row.confidence * 100).toFixed(0)}% · source {row.source}
                          </span>
                          <button
                            onClick={() => dropRow(row.id)}
                            className="flex items-center gap-1 text-red-300 hover:text-red-200"
                            title="Drop this candidate"
                          >
                            <Trash2 className="w-3 h-3" /> drop
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button variant="secondary" onClick={() => setExtract(null)} disabled={committing}>
                  Back
                </Button>
                <Button variant="secondary" onClick={onClose} disabled={committing}>
                  Cancel
                </Button>
                <Button onClick={commit} disabled={committing || selectedCount === 0}>
                  {committing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Adding…
                    </>
                  ) : (
                    <>Add {selectedCount} selected to board</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition ${
        active
          ? "border-accent text-white"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

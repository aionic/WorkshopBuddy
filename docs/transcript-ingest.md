# Transcript Ingestion for Workshop Studio — Implementation Plan

> **Status:** Design proposal. No code changes have been made.
> **Goal:** Let a facilitator upload a meeting/workshop transcript and have Workshop Buddy automatically populate the Workshop Board with categorized, persona-tagged, prioritized input cards — all using the existing categories, personas, and data model.

---

## 1. Problem statement

Today the Workshop Studio (`src/components/workshop-board.tsx`) only accepts manual entry: a facilitator types each pain point, opportunity, or KPI target into a form and saves it as a `WorkshopInput` row. For most real customer engagements the raw material already exists — a Teams transcript, a Word/PDF discovery write-up, or pasted notes — and re-typing it loses time and fidelity.

We want a **"Import from transcript"** path that:

1. Accepts a transcript file (or pasted text) on a per-project basis.
2. Sends it through an AI extraction step that produces a structured list of candidate Workshop Board cards, each tagged with category / persona / priority and a short evidence quote.
3. Presents the candidates in a **review-and-approve** UI so the facilitator can edit, drop, or accept items in bulk before they hit the board.
4. Persists accepted items as standard `WorkshopInput` rows so the rest of the 11-agent workflow continues to work unchanged.

---

## 2. Design principles

- **Reuse the existing data model.** No new tables strictly required for v1; a small `TranscriptIngest` audit table is optional for v1.1.
- **Reuse the existing AI provider abstraction.** Add one new agent definition (the "Transcript Intake Agent"), not a new provider or HTTP path to Foundry.
- **Reuse the existing input enums.** Categories, personas, and priorities stay exactly as defined in `workshop-board.tsx` so downstream agents (Pain Point Synthesis, Business Impact, etc.) keep working.
- **Human-in-the-loop, by default.** AI suggestions are *proposed*, not auto-committed. This matches the existing "AI-drafted content requires human review" disclaimer.
- **Graceful demo mode.** If no live AI is configured (`isLiveAIConfigured() === false`), the feature must still work using a deterministic heuristic extractor — same pattern the orchestrator already follows.

---

## 3. User experience

### 3.1 Entry point

On the Workshop Studio page (`src/app/projects/[projectId]/workshop/page.tsx`) add a new **"Import from transcript"** button next to the existing "Add input" form. Clicking it opens a modal/drawer with three tabs:

1. **Paste text** — `<textarea>` for pasting a transcript or notes (no upload required, simplest path, works on every browser).
2. **Upload file** — drag-and-drop or file picker accepting:
   - `.txt`, `.md`, `.vtt`, `.srt` (plain text / captions — parsed inline)
   - `.docx` (Word — parsed server-side with `mammoth`)
   - `.pdf` (parsed server-side with `pdf-parse`)
3. **From URL** *(stretch, v1.1)* — paste a SharePoint/OneDrive/Stream URL for a Teams meeting transcript. Out of scope for v1 because it requires Graph auth flow.

Optional facilitator hints field: a single-line text input — "Audience is the CFO; focus on cost reduction" — appended to the agent's user prompt. Mirrors the existing **Custom instructions** field on the Agent Workflow page.

### 3.2 Review-and-approve panel

After upload/paste, the modal shows a progress indicator while the server runs the Transcript Intake Agent, then displays a table of **candidate cards**:

| ✓ | Category (editable) | Persona (editable) | Priority (editable) | Content (editable) | Evidence quote (read-only) |
|---|---|---|---|---|---|

- Each row is pre-checked. Facilitator can uncheck items, edit any field inline, or click **Edit details** for a richer form.
- Bulk actions: **Select all**, **Deselect all**, **Filter by category**, **Filter by persona**.
- Footer buttons: **Add selected to board** (commits the accepted rows via batch POST) and **Cancel**.
- After commit, the modal closes and the existing inputs list refreshes (same `router.refresh()` pattern the current form uses).

### 3.3 Empty-state and errors

- If the transcript is too short or the agent extracts zero items, show "No workshop items could be extracted — try pasting more context or adjusting the hints."
- If parsing fails (unsupported file, corrupted PDF), surface a precise error message and offer the **Paste text** fallback.
- If the AI call fails, fall back to the deterministic extractor and show a small **"Generated with demo extractor"** badge on each card.

---

## 4. Architecture

```text
┌─────────────────────────────┐
│  Workshop Studio UI         │
│  (workshop-board.tsx)       │
│  + new <ImportTranscript />  ├──┐
└─────────────────────────────┘  │
                                 │ POST /api/projects/[id]/transcripts/extract
                                 │  multipart or JSON { text, hints }
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/projects/[id]/transcripts/extract                │
│    1. Auth/project lookup (existing pattern)                │
│    2. Parse upload → plain text                             │
│       - text/markdown/vtt/srt: read directly                │
│       - docx: mammoth.extractRawText                        │
│       - pdf:  pdf-parse                                     │
│    3. Normalize (strip timestamps, collapse whitespace)     │
│    4. Chunk if > N tokens (~12k chars per chunk)            │
│    5. Call runTranscriptIntakeAgent(text, project, hints)   │
│    6. Return { candidates: WorkshopInputDraft[] }           │
│       (NOTHING is persisted yet)                            │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/projects/[id]/inputs/batch                       │
│    Body: { items: WorkshopInputDraft[] }                    │
│    Validates each (category required, content required,     │
│      category ∈ CATEGORIES, persona ∈ PERSONAS ∪ null,     │
│      priority ∈ PRIORITIES).                                │
│    Single prisma.workshopInput.createMany call.             │
│    Returns the inserted rows (or count + ids).              │
└─────────────────────────────────────────────────────────────┘
```

The split between **extract** (read-only, returns drafts) and **batch insert** (writes after user approval) is intentional — it keeps AI cost/latency separate from the commit step and makes the human-in-the-loop natural.

---

## 5. New agent — Transcript Intake Agent

Added to `src/lib/agents/agent-prompts.ts` so it lives next to the other 11 agents.

```ts
{
  name: "Transcript Intake Agent",
  role: "Extracts structured Workshop Board input cards from a meeting transcript or raw notes.",
  systemPrompt: `You are the Transcript Intake Agent for Workshop Buddy.

Input is a single text blob: a meeting transcript, Teams captions, or raw notes from a customer discovery conversation. Your job is to extract a list of discrete Workshop Board input cards.

Rules:
- Each card represents ONE atomic idea (one pain point, one outcome, one constraint, one quote, etc.). Do not bundle multiple ideas.
- 'category' MUST be exactly one of: Pain Point | Business Outcome | Process Bottleneck | Customer Impact | Operational Impact | Technical Constraint | Solution Idea | KPI / Metric | Risk / Dependency | Cost of Inaction.
- 'persona' MUST be exactly one of: Operations | IT | Finance | Compliance | Customer Experience | Sales | Marketing | Engineering | Executive. Use null only if no persona is clearly implied.
- 'priority' MUST be exactly one of: Low | Medium | High | Critical. Default to Medium when severity is unclear.
- 'content' is a crisp 1-2 sentence paraphrase suitable for a sticky note. Do NOT include speaker names or timestamps.
- 'evidence' is a verbatim quote (≤ 240 chars) from the transcript that justifies this card. If no direct quote, use "" (empty string).
- 'confidence' is a number 0-1 reflecting how clearly the transcript supports this card.
- Aim for 10-40 cards depending on transcript length. Quality over quantity. Deduplicate near-identical ideas.
- Hard cap: never return more than 50 cards in total.
- If the user provided facilitator hints, weight cards that align with those hints higher.`,
  schemaHint: `{
    "cards": [
      {
        "category": "Pain Point",
        "persona": "Operations" | null,
        "priority": "Medium",
        "content": "Document intake takes 6+ hours per case because reviewers retype scanned PDFs by hand.",
        "evidence": "We have a team of twelve people who literally retype every page.",
        "confidence": 0.9
      }
    ]
  }`
}
```

Invocation lives in a new file `src/lib/agents/transcript-intake.ts` exporting `runTranscriptIntakeAgent(text, project, hints?)`. It:

1. Builds the user prompt: project context (name, industry, business problem, desired outcomes) + facilitator hints + the transcript chunk.
2. Calls `provider.generateStructuredJson<TranscriptIntakeOutput>(...)`.
3. Sanity-filters the response (drop cards with invalid enum values or empty content; cap length at 50 cards; deduplicate by lowercase content).
4. Returns `{ cards: WorkshopInputDraft[] }` plus an `usedLLM` flag, exactly like the other agent functions.

For long transcripts (> ~12k chars), call the agent per chunk and merge+dedupe the results client-side of the server route.

### Demo-mode fallback

When `isLiveAIConfigured()` is false (or the LLM call throws), the route falls back to a deterministic extractor in `src/lib/agents/transcript-intake.ts`:

- Split transcript into sentences.
- For each sentence apply lightweight keyword heuristics:
  - "slow / waiting / manual / hours / takes too long" → **Pain Point**
  - "we want / our goal / would like / improve" → **Business Outcome**
  - "compliance / regulation / audit / GDPR / HIPAA" → **Risk / Dependency**, persona **Compliance**
  - "cost / budget / spend / dollars / FTE" → **Cost of Inaction**, persona **Finance**
  - "system / API / integration / legacy / database" → **Technical Constraint**, persona **IT**
  - "customer / NPS / satisfaction" → **Customer Impact**, persona **Customer Experience**
  - "we could / what if / idea / pilot" → **Solution Idea**
  - Number + "%" / "x" / "reduce" / "by" → **KPI / Metric**
- Persona inference: scan ±1 sentence for role nouns ("CFO", "IT manager", "sales rep") and map to the persona enum.
- Priority: "critical / blocker / must" → Critical; "important / major" → High; default Medium.
- Cap at 30 cards. Mark each output with `confidence: 0.4` so the UI can show a "demo extraction" badge.

This keeps the feature functional in every environment, mirroring the existing demo-fallback contract.

---

## 6. New types and helpers

In `src/lib/agents/transcript-intake.ts`:

```ts
export type WorkshopInputDraft = {
  category: typeof CATEGORIES[number];
  persona: typeof PERSONAS[number] | null;
  priority: typeof PRIORITIES[number];
  content: string;
  evidence: string;
  confidence: number;        // 0..1
  source: "ai" | "demo";
};

export type TranscriptIntakeOutput = {
  cards: WorkshopInputDraft[];
  usedLLM: boolean;
  llmError?: string;
};
```

The `CATEGORIES` / `PERSONAS` / `PRIORITIES` arrays are currently defined inside `workshop-board.tsx`. Lift them into a new shared module `src/lib/workshop-enums.ts` so both the UI and the agent import the same source of truth.

---

## 7. New / changed files

| Path | Change | Notes |
|---|---|---|
| `src/lib/workshop-enums.ts` | **new** | Shared `CATEGORIES`, `PERSONAS`, `PRIORITIES` constants + `as const` types. |
| `src/lib/agents/agent-prompts.ts` | edit | Add the Transcript Intake Agent definition (kept separate from the 11-agent orchestrator). |
| `src/lib/agents/transcript-intake.ts` | **new** | `runTranscriptIntakeAgent()` + deterministic demo extractor + sanity-filter helpers. |
| `src/lib/transcripts/parse.ts` | **new** | `parseTranscriptUpload(file: Blob, mime: string): Promise<string>`. Switches on mime / extension; uses `mammoth` for docx, `pdf-parse` for pdf, raw text for everything else. Strips VTT/SRT timestamps. |
| `src/app/api/projects/[projectId]/transcripts/extract/route.ts` | **new** | `POST` route. Accepts multipart (`file` field) OR JSON `{ text, hints? }`. Returns `{ cards: WorkshopInputDraft[] }`. `export const maxDuration = 300`. |
| `src/app/api/projects/[projectId]/inputs/batch/route.ts` | **new** | `POST` route. Validates and bulk-inserts via `prisma.workshopInput.createMany`. Returns the inserted rows. |
| `src/components/workshop-board.tsx` | edit | Add **"Import from transcript"** button + state for opening the new modal. Refresh the inputs list after the batch insert succeeds. Switch to `CATEGORIES`/`PERSONAS`/`PRIORITIES` imports from the shared module. |
| `src/components/transcript-import-modal.tsx` | **new** | Three-tab modal (Paste / Upload / URL-disabled-v1), progress indicator, the candidate-review table, and the batch-commit call. |
| `src/components/ui.tsx` | minor edit | Add a small `<Tabs>` / `<Modal>` primitive if one doesn't already exist (otherwise inline with Tailwind). |
| `package.json` | edit | Add deps: `mammoth` (~MIT, ~3 MB), `pdf-parse` (~MIT, ~1 MB). Keep them as direct deps so they're bundled into the Container App image. |
| `prisma/schema.prisma` | **(optional v1.1)** | Add a `TranscriptIngest` audit row (id, projectId, source filename, charLength, cardCount, createdAt) for visibility. **Not required for v1.** |
| `src/app/help/page.tsx` | edit | Add a short "Import from transcript" section to the facilitator playbook. |
| `src/lib/agents/agent-prompts.ts` | edit | Document the Transcript Intake Agent alongside the existing 11. |
| `README.md` | edit | One-paragraph note + screenshot placeholder. |

No changes required to the 11-agent orchestrator — once the rows are written via `createMany`, the downstream workflow consumes them exactly as it does manually-entered cards.

---

## 8. Validation & security

- **File size limit**: 10 MB per upload, enforced both client-side (file input `accept` + size check) and server-side (return 413 if exceeded).
- **Allowed MIME types**: explicit allow-list. Anything else → 415.
- **Server-side parsing only** for binary formats (docx/pdf) — never trust the file extension; sniff via mime-type and `mammoth`/`pdf-parse` error handling.
- **No raw HTML rendering** of transcript content. All extracted text is escaped before being shown in the candidate table.
- **AI output sanitization**: every `card.category` / `card.persona` / `card.priority` is validated against the enums before write; invalid rows are dropped, not coerced.
- **Project authorization**: the extract and batch-insert routes resolve the project via `prisma.project.findUnique({ where: { id: projectId } })` (same pattern as existing routes) and return 404 if missing.
- **Rate limiting (v1.1)**: optional simple in-memory throttle (3 transcript extractions / project / minute) to avoid runaway token spend.
- **Telemetry**: log `{ projectId, charLength, cardCount, usedLLM, durationMs }` (no transcript content) so we can monitor cost and quality. Reuses the existing `console.log` pattern in the orchestrator.

---

## 9. Cost & performance

- Typical 30-minute Teams transcript is ~4-6k words / ~25k chars. Comfortably one Foundry call per transcript at gpt-5.4 (~6-8k input tokens, ~2-3k output tokens).
- For transcripts > 12k chars, chunk by paragraph boundary, run the agent in parallel (`Promise.all`), then merge+dedupe. Cap concurrency at 3.
- Total wall time target: < 30 seconds for a typical transcript.

---

## 10. Rollout plan

1. **Slice 1 — server-side extraction (no UI)**
   - Add the shared enums module, the new agent definition, `transcript-intake.ts`, `parse.ts`, and the `/transcripts/extract` route.
   - Add a Vitest/Jest harness (or simple `npm run` script) that runs the deterministic fallback against a fixture transcript and asserts cards are produced.
2. **Slice 2 — batch insert route**
   - Add `/inputs/batch` with validation; manual `curl` smoke test against a seeded project.
3. **Slice 3 — UI modal (paste-text tab only)**
   - Implement the modal, candidate review table, and refresh-on-commit. Ship this first — it unlocks 90% of the value with the least surface area.
4. **Slice 4 — file upload tab**
   - Wire multipart upload, add `mammoth` + `pdf-parse`, run end-to-end against a real Teams transcript export and a real PDF discovery doc.
5. **Slice 5 — polish**
   - Hints field, "Generated with demo extractor" badge, confidence sorting, persona/category filter chips in the review table.
6. **v1.1 (deferred)**
   - Audit table (`TranscriptIngest`)
   - Microsoft Graph / Stream URL ingestion
   - "Re-extract with different hints" button
   - Optional: link each `WorkshopInput` row back to its source transcript via a nullable `sourceRef` field for traceability.

Estimated implementation: slices 1-3 land first (smallest end-to-end value), slices 4-5 follow once we've validated the agent quality on real transcripts.

---

## 11. Open questions for sign-off

1. **Auto-commit vs review?** Plan above is review-first. Confirm we don't want a "trust the AI — write directly" toggle for power users.
2. **Persona inference strictness.** Should we require a persona on every card, or allow `null` (current plan)? Manual entry already allows persona = null implicitly.
3. **PDF dependency.** `pdf-parse` pulls in `pdfjs-dist`. Acceptable image size cost, or scope v1 to text/docx only?
4. **Multilingual transcripts.** The agent prompt is English-only. Add a "detected language" guard for v1?
5. **Card cap.** 50 hard cap reasonable, or should we make it configurable per project?
6. **Audit trail.** Build the optional `TranscriptIngest` table in v1 anyway for traceability, or defer to v1.1?

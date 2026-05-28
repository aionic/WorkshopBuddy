# Agents

Workshop Buddy ships **11 specialized agents** plus a side-path **Transcript Intake Agent**. Each agent is a persona-card system prompt + JSON output schema in [src/lib/agents/agent-prompts.ts](../src/lib/agents/agent-prompts.ts), executed sequentially by the orchestrator in [src/lib/agents/orchestrator.ts](../src/lib/agents/orchestrator.ts).

> Companion docs: [architecture.md](architecture.md) · [ui-flows.md](ui-flows.md) · [azure-architecture.md](azure-architecture.md) · [transcript-ingest.md](transcript-ingest.md)

---

## Why 11 agents?

Single-prompt artifact generation collapses under its own context: you can't ask one LLM call to cluster pain points, defend a business case, sketch an architecture, build a 90-day plan, and render an executive deck without one of those concerns drowning out the others. Workshop Buddy splits the work along **persona expertise lines** — each agent has a distinct expertise lens, a small handoff contract, and a typed JSON output. Downstream agents read upstream output under `upstream.<agentName>` keys so the chain stays explicit and debuggable.

Every agent has a deterministic JavaScript fallback so the workflow never breaks the demo — if the LLM is unavailable or returns invalid JSON, the fallback produces credible content grounded in the workshop inputs.

---

## The eleven agents

| # | Agent | Persona lens | Produces | Consumed by |
| --- | --- | --- | --- | --- |
| 1 | **Intake Clarification** | Workshop translator | Refined problem + outcome statement + assumptions + open questions | All downstream agents |
| 2 | **Pain Point Synthesis** | Theme clustering | Pain-point clusters with severity + evidence quotes | Business Impact, Solution Concept, Reviewer |
| 3 | **Business Impact** | CFO lens | Cost drivers, revenue leakage, productivity, CX, risk, cost-of-inaction | Solution Concept, KPI, Executive Storytelling |
| 4 | **Solution Concept** | Solution architect | Solution vision, core capabilities, tech components, HITL model | Architecture, Roadmap, Executive Storytelling |
| 5 | **Architecture & Solution Map** | Reference-architect | End-to-end stages, components, data flow, governance | Roadmap, Artifact Packager |
| 6 | **KPI & Value** | Value engineer | KPI framework, baseline + target metrics, measurement method | Roadmap, Executive Storytelling, Artifact Packager |
| 7 | **Roadmap** | Delivery lead | 30/60/90-day plan, workstreams, milestones, dependencies, decision gates | Executive Storytelling, Artifact Packager |
| 8 | **Executive Storytelling** | Board narrator | Executive summary, board-ready storyline, slide outline, speaker notes | Artifact Packager |
| 9 | **Artifact Packager** | Production editor | Structured artifact JSON per requested type (Impact Statement, Briefing Deck, Solution Map, 90-Day Plan, KPI Framework, Trends White Paper) | Application Spec, Review & Quality, renderers |
| 10 | **Application Spec** | VS Code + Copilot prompt engineer | Developer-ready spec brief for vibe coding | Reviewer |
| 11 | **Review & Quality** | QA reviewer | Quality score, missing sections, suggested edits, consistency warnings | UI surfacing |

The side-path **Transcript Intake Agent** ([src/lib/agents/transcript-intake.ts](../src/lib/agents/transcript-intake.ts)) is independent — it runs only when a facilitator uses the *Import from transcript* button on Workshop Studio, and it produces candidate `WorkshopInput` cards for human review. See [transcript-ingest.md](transcript-ingest.md).

---

## Handoff graph

```mermaid
flowchart TD
  Inputs(["Project intake + WorkshopInputs"])

  A1["1. Intake Clarification<br/>refinedProblem / outcomeStatement<br/>assumptions / openQuestions"]
  A2["2. Pain Point Synthesis<br/>clusters / severity / evidence"]
  A3["3. Business Impact<br/>cost drivers / cost of inaction"]
  A4["4. Solution Concept<br/>vision / capabilities / HITL"]
  A5["5. Architecture & Solution Map<br/>stages / components / data flow"]
  A6["6. KPI & Value<br/>baseline / target / measurement"]
  A7["7. Roadmap<br/>30/60/90 / workstreams / gates"]
  A8["8. Executive Storytelling<br/>narrative / slide outline / SNs"]
  A9["9. Artifact Packager<br/>structured artifact JSON per type"]
  A10["10. Application Spec<br/>dev brief for vibe coding"]
  A11["11. Review & Quality<br/>score / gaps / edits"]

  Renderers["Markdown / DOCX / PPTX renderers"]
  DB[("Artifact table<br/>(persistArtifacts)")]

  Inputs --> A1
  A1 --> A2 --> A3
  A1 --> A4
  A2 --> A4
  A3 --> A4
  A4 --> A5
  A3 --> A6
  A4 --> A7
  A6 --> A7
  A4 --> A8
  A3 --> A8
  A7 --> A8
  A1 --> A9
  A2 --> A9
  A5 --> A9
  A6 --> A9
  A7 --> A9
  A8 --> A9
  A9 --> A10
  A9 --> A11
  A9 --> Renderers --> DB
```

Solid arrows = required upstream payload; an agent reads each parent's output from `upstream.<camelCaseName>` in its user-prompt context. The orchestrator validates these dependencies via the `dependsOn` field on each [AgentDefinition](../src/lib/agents/agent-prompts.ts).

---

## Run lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant U as Facilitator
  participant UI as Agent Workflow Canvas
  participant API as POST /agent-runs
  participant Q as Service Bus
  participant W as Worker Job
  participant O as Orchestrator
  participant F as Foundry / fallback
  participant DB as Postgres

  U->>UI: Run Full Workflow
  UI->>API: POST {mode, artifactTypes, customInstructions}
  API->>DB: INSERT AgentRun {status:"Queued"}
  API->>Q: send {version:1, runId, projectId}
  API-->>UI: 202 {runId}
  UI->>UI: Poll GET /agent-runs/{runId}

  Q->>W: peek-lock
  W->>O: runInnovationWorkflow(projectId, options)
  loop For each of 11 agents
    O->>F: structured JSON call
    alt LLM ok
      F-->>O: validated JSON
    else LLM unavailable / invalid JSON
      O->>O: Deterministic fallback
    end
    O->>DB: per-agent log line (logJson)
  end
  O->>DB: persistArtifacts() in $transaction
  O-->>W: {artifacts, review}
  W->>DB: UPDATE AgentRun {status:"Completed", outputJson}
  W->>Q: completeMessage()

  UI->>UI: Poll sees status=Completed
  UI->>U: Render artifact list + previews
```

---

## Anti-patterns the persona cards enforce

Every agent's `systemPrompt` follows the same shape (see the persona-card template comment at the top of [agent-prompts.ts](../src/lib/agents/agent-prompts.ts)) and ends with an explicit anti-patterns list. The recurring ones:

- **Inventing client facts** — financial values, customer names, commitments not in the inputs.
- **Restating upstream** — each agent must transform, not echo.
- **Generic marketing language** — agents are prompted to flag this as a failure mode.
- **Refusing on sparse inputs** — every agent has an *escape hatch* directive: emit minimum valid JSON, flag gaps in `assumptions`, do not refuse.
- **Wrapping JSON in code fences** — the closing line of every system prompt is *"Emit ONLY the JSON object matching the schema. No preamble, no trailing prose, no markdown fences around the top-level object."*

---

## Adding a new agent

1. Add a new `AgentDefinition` to the appropriate export in [src/lib/agents/agent-prompts.ts](../src/lib/agents/agent-prompts.ts) — fill out all 9 sections of the persona-card template.
2. Add a `dependsOn` list of upstream agent display names; add yourself to the `produces` list of each parent.
3. Add a deterministic fallback in [orchestrator.ts](../src/lib/agents/orchestrator.ts) — never let the LLM be the only code path.
4. Add a schema for the new artifact (if any) in [src/lib/artifacts/artifact-schemas.ts](../src/lib/artifacts/artifact-schemas.ts) plus a renderer entry in the markdown/docx/pptx renderers.
5. Update the handoff graph above.

---

## See also

- [architecture.md](architecture.md) — code structure + run flow
- [transcript-ingest.md](transcript-ingest.md) — transcript intake side-path
- [src/lib/prompts/](../src/lib/prompts/) — shared system + packager + regenerate prompts
- [spec/InnovateImpact.md](spec/InnovateImpact.md) §8 — original agent spec

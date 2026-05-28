# UI Flows

Workshop Buddy is built around four primary surfaces a facilitator uses live in a workshop: **Workshop Studio**, **Agent Workflow**, **Artifacts**, and the **Project** dashboard.

> Companion docs: [architecture.md](architecture.md) · [agents.md](agents.md) · [transcript-ingest.md](transcript-ingest.md)

---

## Navigation map

```mermaid
flowchart LR
  Shell["AppShell sidebar"]

  Shell --> Dashboard["/<br/>Dashboard"]
  Shell --> Projects["/projects<br/>Project list"]
  Shell --> Workshop["/workshop<br/>(picker → /projects/[id]/workshop)"]
  Shell --> Agents["/agents<br/>(picker → /projects/[id]/agents)"]
  Shell --> Artifacts["/artifacts<br/>(picker → /projects/[id]/artifacts)"]
  Shell --> Settings["/settings"]
  Shell --> Help["/help"]

  Projects --> New["/projects/new<br/>Intake Wizard"]
  Projects --> Project["/projects/[id]<br/>Project overview"]
  Project --> WStudio["/projects/[id]/workshop<br/>Workshop Studio"]
  Project --> AWF["/projects/[id]/agents<br/>Agent Workflow Canvas"]
  Project --> Arts["/projects/[id]/artifacts<br/>Artifact Workspace"]
  Project --> Edit["/projects/[id]/edit"]
```

The top-level `/workshop`, `/agents`, and `/artifacts` pages are facilitator-friendly entry points — they show a project picker and deep-link into the project-scoped equivalents.

---

## Core facilitator flow (end-to-end)

```mermaid
flowchart TD
  Start([Facilitator opens app]) --> Auth["Easy Auth login<br/>(Entra single-tenant)"]
  Auth --> Dash[Dashboard]
  Dash --> Decide{New or existing<br/>project?}

  Decide -->|New| NewProj["/projects/new<br/>3-step Intake Wizard"]
  Decide -->|Existing| PickProj[Pick from list]
  NewProj --> Created[/Project created/]
  PickProj --> Open[Open Project]
  Created --> Studio

  Open --> Studio["Workshop Studio<br/>Capture inputs"]
  Studio --> Inputs{Input source?}
  Inputs -->|Manual| AddCard[Add card<br/>category / persona / priority]
  Inputs -->|Live transcript| Import["Import from transcript<br/>(docx / pdf / vtt / srt / txt / md)"]
  Inputs -->|Voting| Vote[Vote / refine cards]

  Import --> Intake["Transcript Intake Agent<br/>proposes candidate cards"]
  Intake --> Review["Human review<br/>accept / edit / discard"]
  Review --> AddCard
  Vote --> AddCard
  AddCard --> Ready{Enough signal?}

  Ready -->|No| Studio
  Ready -->|Yes| AWFNav["Open Agent Workflow"]

  AWFNav --> Configure["Pick mode + artifact types<br/>+ custom instructions"]
  Configure --> Run["Run Full Workflow<br/>(POST /agent-runs)"]
  Run --> Poll["UI polls /agent-runs/{id}"]
  Poll --> Done{Completed?}
  Done -->|No| Poll
  Done -->|Yes| ArtsView["Artifact Workspace"]

  ArtsView --> Action{Action?}
  Action -->|Preview| Preview[Markdown preview]
  Action -->|Download| Dl["DOCX / PPTX / MD"]
  Action -->|Regenerate| Regen["POST .../regenerate<br/>(custom instructions)"]
  Regen --> Poll

  ArtsView --> End([Walk into the room])
```

---

## Workshop Studio (in depth)

```mermaid
flowchart LR
  subgraph WS["/projects/[id]/workshop"]
    Board["WorkshopBoard component"]
    Filters["Category / persona / priority filters"]
    Add["Add card form"]
    ImportBtn["Import from transcript"]
    VoteUI["Vote +/- per card"]
  end

  Board --> APIList["GET /projects/[id]/inputs"]
  Add --> APICreate["POST /projects/[id]/inputs"]
  VoteUI --> APIVote["POST /inputs/[id]/vote"]
  ImportBtn --> Modal["TranscriptImportModal"]
  Modal --> APIExtract["POST /projects/[id]/transcripts/extract<br/>(1 MB text cap)"]
  APIExtract --> Cards["Candidate cards + reasoning"]
  Cards --> Accept["POST /projects/[id]/inputs/batch<br/>(zod batch envelope)"]
```

---

## Agent Workflow canvas

```mermaid
flowchart LR
  subgraph Canvas["/projects/[id]/agents"]
    Graph["AgentWorkflowCanvas<br/>(11-node graph + status pills)"]
    Picker["Artifact type multi-select"]
    Mode["Mode: full / packaging-only / regenerate"]
    Custom["Custom instructions textarea"]
    Run["Run Full Workflow"]
    History["Past runs list"]
  end

  Run --> APIRun["POST /projects/[id]/agent-runs"]
  APIRun --> Queue["Service Bus enqueue<br/>(or in-process if no SB)"]
  History --> APIList["GET /projects/[id]/agent-runs"]
  Graph --> APIPoll["GET /agent-runs/[runId]<br/>(2 s poll, status + logJson)"]
```

---

## Artifact Workspace

```mermaid
flowchart LR
  subgraph Arts["/projects/[id]/artifacts"]
    List["ArtifactWorkspace<br/>(card per artifactType)"]
    Preview["Markdown preview pane"]
    DlBtn["Download menu"]
    RegenBtn["Regenerate"]
    Vers["Versions drawer"]
  end

  List --> APIList["GET /projects/[id]/artifacts"]
  Preview --> APIGet["GET /artifacts/[id]"]
  DlBtn --> APIDl["GET /artifacts/[id]/download?format=docx|pptx|md"]
  RegenBtn --> APIRegen["POST /artifacts/[id]/regenerate"]
  APIRegen --> AWFLoop["(re-enters Agent Workflow loop)"]
```

---

## State + status conventions

`AgentRun.status` transitions surfaced in the UI:

```mermaid
stateDiagram-v2
  [*] --> Queued: API enqueue
  Queued --> Running: Worker picks up
  Running --> Completed: persistArtifacts() ok
  Running --> Failed: error / fallback emitted error envelope
  Running --> Cancelled: user cancel
  Running --> Failed: Sweeper marks > 30 min old as Failed
  Completed --> [*]
  Failed --> [*]
  Cancelled --> [*]
```

The agent canvas color-codes per-agent status from the `logJson` array inside the run record so a facilitator can see, mid-run, which agent is currently executing.

---

## Accessibility + facilitator-mode niceties

- All primary actions are keyboard-reachable (workshop input form, vote buttons, run workflow).
- Large click targets and high-contrast status pills — workshop rooms are projector-bright.
- Settings page lets the facilitator switch between **demo mode** (mock provider) and **live mode** without redeploying.
- `/help` ([src/app/help/page.tsx](../src/app/help/page.tsx)) carries the facilitator playbook and the recommended workshop run-of-show.

---

## See also

- [architecture.md](architecture.md) — request flow + container boot
- [agents.md](agents.md) — what the workflow actually produces
- [transcript-ingest.md](transcript-ingest.md) — Workshop Studio import detail

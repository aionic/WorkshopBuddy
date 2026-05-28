# Application Requirements Specification: Workshop Buddy

> **Historical document.** This is the original product requirements spec that drove the MVP build. Keep it for context, but treat the live codebase + [../architecture.md](../architecture.md) / [../agents.md](../agents.md) / [../azure-architecture.md](../azure-architecture.md) / [../deployment.md](../deployment.md) as the source of truth. Things that have since diverged from this spec:
>
> - **Folder layout** — the app lives at the repo root, not under `innovate-impact/`. Section 16 below is historical.
> - **Database** — Azure Postgres Flexible Server (Entra-only) instead of SQLite/Azure SQL.
> - **Agents** — 11 agents shipped (Application Spec Agent added alongside the 10 in §8). Transcript Intake Agent runs as a side-path on Workshop Studio.
> - **Background runs** — orchestrator runs in a Service Bus-backed Container Apps Job, not inline in the API route.
> - **Auth** — single-tenant Entra Easy Auth at the ACA platform layer, not stubbed.

**Application name:** Workshop Buddy  
**Working codename:** InnovateImpact  
**Tagline:** Delivering AI-Powered Solution Design at Enterprise Speed  
**Deployment target:** Azure Container Apps  
**Primary user experience:** Modern web application for live workshop facilitation, AI-driven business impact creation, and downloadable executive-ready work products  
**MVP intent:** Demo application, not final production product

---

## 1. Product Vision

Workshop Buddy is an AI agentic workflow application that helps facilitators, business leaders, engineers, sales teams, marketing teams, and customer stakeholders turn live discovery inputs into executive-ready work products in real time.

The application replaces the traditional slow, meeting-heavy innovation process with a structured, AI-powered engine. Instead of requiring many people to manually define requirements, scope, value, architecture, roadmap, risks, and business justification over weeks or months, the application captures stakeholder inputs during a workshop and uses AI agents to generate aligned solution artifacts in minutes.

Core positioning statement:

> We have turned innovation from a slow, meeting-heavy process into a structured, AI-powered engine that delivers aligned solutions in days, not months.

The demo should show that Microsoft can use AI to rapidly convert a business problem into tangible outputs such as an impact statement, executive briefing, solution map, modernization roadmap, KPI framework, and 90-day execution plan.

---

## 2. Primary Business Scenario for Demo

The initial demo scenario is high-volume document processing modernization, specifically moving from legacy OCR-based document workflows to generative AI-powered document intelligence.

The application must be domain-flexible, but it should ship with a sample scenario based on:

- Legacy OCR reaching an economic and operational ceiling.
- High manual exception handling cost.
- Straight-through-processing limitations.
- Long onboarding cycles for new document types and layouts.
- Lack of semantic understanding, cross-document reasoning, anomaly detection, and natural-language summarization.
- Opportunity to use Azure AI Document Intelligence, Azure AI Vision, Azure OpenAI, Microsoft Fabric, OneLake, Azure AI Search, Logic Apps, Power Automate, Copilot Studio, Teams, Purview, and Azure AI Content Safety.

The demo should allow a facilitator to enter a business problem such as:

> Our organization processes millions of scanned, emailed, and photographed documents using legacy OCR. We struggle with high exception rates, slow onboarding of new document types, limited visibility, and too much manual interpretation. We need a practical modernization plan that reduces cost, improves speed, raises straight-through-processing, and creates new analytics value from our document stream.

---

## 3. What the Application Is Solving

Traditional innovation and solution design efforts are often slowed by:

- Too many stakeholders required in too many meetings.
- Fragmented discovery notes and whiteboard sessions.
- Slow translation from pain points to solution options.
- Manual drafting of executive summaries, roadmaps, architecture narratives, and business cases.
- Lost context between sales, engineering, operations, marketing, and customer teams.
- Inconsistent artifact quality from workshop to workshop.
- Delayed alignment on measurable outcomes and investment justification.

Workshop Buddy solves this by:

- Capturing workshop inputs in a structured, collaborative interface.
- Organizing pain points, desired outcomes, business impacts, current-state limitations, solution ideas, risks, dependencies, and success metrics.
- Using specialized AI agents to synthesize inputs into actionable solution artifacts.
- Creating downloadable Word documents and PowerPoint decks.
- Saving projects, workshop inputs, generated outputs, and artifact versions.
- Allowing humans to review, refine, regenerate, and approve outputs.

---

## 4. Target Users and Personas

### 4.1 Facilitator

The facilitator runs the workshop and controls the AI workflow.

Capabilities:

- Create a new project.
- Configure the business scenario.
- Invite participants or enter inputs manually.
- Start and stop live workshop sessions.
- Trigger AI synthesis.
- Review and approve generated outputs.
- Download artifacts.

### 4.2 Participant / Subject Matter Expert

Participants contribute pain points, desired outcomes, business context, constraints, and ideas.

Capabilities:

- Join a workshop session using a simple link or code.
- Submit structured input cards.
- Tag inputs by category.
- Upvote or prioritize inputs.
- Comment on generated synthesis items.

### 4.3 Solution Engineer

Solution engineers validate solution architecture, technology mapping, assumptions, dependencies, risks, and feasibility.

Capabilities:

- Add technical notes.
- Edit generated solution maps.
- Add technology components and integration points.
- Review the roadmap.
- Flag assumptions or implementation risks.

### 4.4 Executive Reviewer

Executive reviewers consume the final work products and provide approval or direction.

Capabilities:

- View executive summary.
- Review business impact and cost of inaction.
- Download executive briefing deck.
- Review KPI framework and 90-day plan.

---

## 5. MVP Scope

The MVP should be a modern, polished demo web app that includes the following:

1. Project creation and persistence.
2. Guided project intake form.
3. Live workshop input capture board.
4. AI agent workflow orchestration screen.
5. Artifact generation engine.
6. Artifact preview and editing screen.
7. Download center for Markdown, Word, and PowerPoint outputs.
8. Simple database persistence using SQLite by default, with optional Azure SQL configuration.
9. Seed demo project for the OCR to GenAI document processing scenario.
10. Dockerized deployment suitable for Azure Container Apps.

Do not overbuild enterprise features in the MVP. Keep authentication, real-time collaboration, and advanced workflow approvals optional or stubbed if needed.

---

## 6. Preferred Technical Stack

Build the application as a single modern web app that is easy to run locally in Visual Studio Code and easy to containerize.

### 6.1 Frontend

- Next.js with React and TypeScript.
- Tailwind CSS for styling.
- shadcn/ui component patterns for clean modern cards, forms, tabs, dialogs, buttons, and tables.
- Optional: Framer Motion for subtle transitions.
- Optional: React Flow for visualizing the agent workflow.

### 6.2 Backend

Use Next.js API routes or server actions for the MVP. Keep the application as one deployable container.

Backend responsibilities:

- Project CRUD.
- Workshop input CRUD.
- Agent run orchestration.
- Artifact generation.
- DOCX and PPTX rendering.
- Download endpoints.

### 6.3 Database

Use Prisma ORM.

Default demo database:

- SQLite stored at `./data/innovateimpact.db`.

Optional production-like database:

- Azure SQL Database using the same Prisma models.

The application should select database provider through environment configuration.

### 6.4 AI Provider

Create an abstraction layer so the application can use either Azure OpenAI or OpenAI-compatible endpoints.

Required environment variables:

```bash
AI_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Implementation requirement:

- Create a provider interface in `src/lib/ai/provider.ts`.
- Implement `generateStructuredJson()` and `generateText()` helper methods.
- Store all AI prompts in versioned files under `src/lib/prompts`.
- Store every agent run input and output in the database.

### 6.5 Document Generation Libraries

Use Node libraries so the app can generate outputs inside Azure Container Apps without requiring Microsoft Office.

Recommended libraries:

- DOCX generation: `docx`
- PPTX generation: `pptxgenjs`
- Markdown generation: native string rendering
- PDF generation: optional stretch goal; avoid depending on LibreOffice for MVP

The MVP must generate Word and PowerPoint downloads. Markdown downloads are also required because they are useful for review and debugging.

---

## 7. UX and Visual Design Requirements

The application should feel like a modern AI studio, not a traditional form-based enterprise app.

### 7.1 Design Principles

- Clean, executive-ready interface.
- Spacious layout with card-based sections.
- Strong visual hierarchy.
- Simple navigation.
- AI workflow should feel transparent and controllable.
- Emphasize human oversight, not fully autonomous black-box output.
- Use a polished demo style suitable for a live customer workshop.

### 7.2 Visual Style

Suggested style:

- Deep navy or charcoal background accents.
- White or light neutral content cards.
- Cyan, electric blue, or teal accent color.
- Rounded cards and subtle shadows.
- Modern typography.
- Clear labels and progress indicators.
- Use icons for inputs, agents, artifacts, downloads, review, and approval.

### 7.3 Primary Navigation

Use a left sidebar or top navigation with these sections:

1. Dashboard
2. Projects
3. Workshop Studio
4. Agent Workflow
5. Artifacts
6. Settings

### 7.4 Key Screens

#### Dashboard

Purpose: Show active projects, recent workshops, and generated artifacts.

Required elements:

- Hero card with application name and tagline.
- â€œCreate New Innovation Projectâ€ button.
- Recent project cards.
- Metrics such as total projects, inputs captured, artifacts generated, and agent runs.
- Seed demo project card for â€œOCR to GenAI Document Intelligence.â€

#### Project Intake Wizard

Purpose: Capture the business problem, context, and target outcomes.

Required sections:

- Project name.
- Client or business unit.
- Industry.
- Problem statement.
- Desired outcomes.
- Current-state pain points.
- Known systems or process constraints.
- Strategic priorities.
- Time horizon.
- Executive audience.
- Output artifacts to generate.

#### Workshop Studio

Purpose: Capture live stakeholder inputs.

Required elements:

- Project context summary panel.
- Live input form.
- Input cards grouped by category.
- Categories:
  - Pain Point
  - Business Outcome
  - Process Bottleneck
  - Customer Impact
  - Operational Impact
  - Technical Constraint
  - Solution Idea
  - KPI / Metric
  - Risk / Dependency
  - Cost of Inaction
- Priority field: Low, Medium, High, Critical.
- Persona field: Operations, IT, Finance, Compliance, Customer Experience, Sales, Marketing, Engineering, Executive.
- Upvote count or priority ranking.
- Facilitator notes panel.

#### Agent Workflow Screen

Purpose: Show the agentic process that converts inputs into outputs.

Required elements:

- Agent workflow visualization.
- Status for each agent: Not Started, Running, Completed, Needs Review, Failed.
- Agent output summaries.
- Buttons:
  - Run Full Workflow
  - Run Selected Agent
  - Regenerate Artifact
  - Approve Output
- Activity log.

#### Artifact Workspace

Purpose: Preview, edit, version, and download generated work products.

Required elements:

- Artifact list grouped by type.
- Artifact preview panel.
- Editable markdown editor.
- Version history.
- Regenerate button with custom instruction field.
- Download buttons for Markdown, DOCX, and PPTX where applicable.

#### Settings

Purpose: Configure model provider, theme, database display, and export defaults.

Required elements:

- AI provider settings.
- Model deployment name.
- Export branding options.
- Demo mode toggle.
- Seed data reset button.

---

## 8. Agentic Workflow Requirements

The application must use a multi-agent workflow design. Agents can be implemented as specialized prompt functions in the MVP. A full agent framework is optional.

### 8.1 Agent List

#### 1. Intake Clarification Agent

Purpose:

- Convert raw project intake into a clear business problem, target outcomes, affected stakeholders, and initial assumptions.

Inputs:

- Project intake fields.
- Workshop inputs.

Outputs:

- Refined problem statement.
- Outcome statement.
- Assumptions.
- Missing information questions.

#### 2. Pain Point Synthesis Agent

Purpose:

- Cluster workshop inputs into common themes.
- Identify operational, customer, financial, technical, and compliance pain points.

Outputs:

- Pain point clusters.
- Severity rating.
- Stakeholder impact mapping.
- Evidence from participant inputs.

#### 3. Business Impact Agent

Purpose:

- Translate pain points into business impact and cost of inaction.

Outputs:

- Cost drivers.
- Revenue leakage opportunities.
- Productivity impacts.
- Customer experience impacts.
- Risk impacts.
- Cost of inaction statement.

#### 4. Solution Concept Agent

Purpose:

- Propose an AI-powered solution concept mapped to business outcomes.

Outputs:

- Solution vision.
- Core capabilities.
- Technology components.
- Human-in-the-loop model.
- Data and workflow model.

#### 5. Architecture and Solution Map Agent

Purpose:

- Generate a reference architecture narrative and solution map.

Outputs:

- End-to-end architecture stages.
- Component roles.
- Integration points.
- Data flow.
- Governance and responsible AI considerations.

#### 6. KPI and Value Agent

Purpose:

- Define measurable outcomes, KPIs, target improvements, and value realization metrics.

Outputs:

- KPI framework.
- Baseline and target metrics.
- Measurement method.
- Executive value summary.

#### 7. Roadmap Agent

Purpose:

- Produce a phased modernization roadmap and 90-day execution plan.

Outputs:

- 30/60/90-day plan.
- Workstreams.
- Milestones.
- Dependencies.
- Resource roles.
- Decision gates.

#### 8. Executive Storytelling Agent

Purpose:

- Transform technical and operational analysis into executive-ready narrative.

Outputs:

- Executive summary.
- Board-ready storyline.
- PowerPoint slide outline.
- Speaker notes.

#### 9. Artifact Packager Agent

Purpose:

- Assemble outputs into specific downloadable artifacts.

Outputs:

- Markdown artifact content.
- DOCX-ready structured content.
- PPTX-ready slide JSON.
- Artifact metadata.

#### 10. Review and Quality Agent

Purpose:

- Review generated artifacts for completeness, consistency, executive tone, and alignment to project inputs.

Outputs:

- Quality score.
- Missing sections.
- Suggested edits.
- Consistency warnings.

---

## 9. Core Data Objects

Use structured JSON internally before rendering documents. This is important because the app should not rely on long unstructured text as the only artifact source.

### 9.1 Project Context JSON

```json
{
  "projectName": "OCR to GenAI Document Intelligence",
  "clientName": "Example Client",
  "industry": "Transportation and Logistics",
  "businessProblem": "Legacy OCR workflows create manual exception handling, slow onboarding, and limited visibility.",
  "desiredOutcomes": [
    "Reduce cost per document",
    "Increase straight-through-processing",
    "Reduce onboarding time",
    "Create governed analytics from document data"
  ],
  "currentState": {
    "systems": ["Legacy OCR", "Workflow queues", "Manual review"],
    "painPoints": [],
    "constraints": [],
    "knownMetrics": []
  },
  "targetAudience": ["CIO", "CTO", "CFO", "Operations Executive"],
  "timeHorizon": "90 days for pilot planning; 6-8 months for full modernization",
  "selectedArtifacts": [
    "Impact Statement",
    "Executive Briefing Deck",
    "Solution Map",
    "90-Day Execution Plan",
    "Trends White Paper"
  ]
}
```

### 9.2 Workshop Input JSON

```json
{
  "id": "input_001",
  "projectId": "project_001",
  "category": "Pain Point",
  "persona": "Operations",
  "priority": "High",
  "content": "Manual exception handling consumes too much operational capacity.",
  "submittedBy": "Facilitator",
  "createdAt": "2026-05-20T10:00:00Z",
  "votes": 3
}
```

### 9.3 Agent Run JSON

```json
{
  "id": "run_001",
  "projectId": "project_001",
  "status": "Completed",
  "startedAt": "2026-05-20T10:05:00Z",
  "completedAt": "2026-05-20T10:07:00Z",
  "agents": [
    {
      "name": "Pain Point Synthesis Agent",
      "status": "Completed",
      "summary": "Clustered 18 inputs into 5 pain point themes."
    }
  ]
}
```

### 9.4 Artifact JSON

```json
{
  "id": "artifact_001",
  "projectId": "project_001",
  "artifactType": "Impact Statement",
  "title": "OCR to GenAI Document Intelligence: Executive Impact Statement",
  "status": "Draft",
  "version": 1,
  "formatAvailability": ["markdown", "docx"],
  "sections": [
    {
      "heading": "Customer Business Problem",
      "content": "Legacy OCR has hit its economic ceiling."
    }
  ],
  "createdAt": "2026-05-20T10:10:00Z"
}
```

---

## 10. Database Schema Requirements

Use Prisma models similar to the following.

```prisma
model Project {
  id              String          @id @default(cuid())
  name            String
  clientName      String?
  industry        String?
  businessProblem String
  desiredOutcomes String          // JSON string
  targetAudience  String          // JSON string
  status          String          @default("Draft")
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  inputs          WorkshopInput[]
  agentRuns       AgentRun[]
  artifacts       Artifact[]
}

model WorkshopInput {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  category    String
  persona     String?
  priority    String   @default("Medium")
  content     String
  submittedBy String?
  votes       Int      @default(0)
  createdAt   DateTime @default(now())
}

model AgentRun {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  status      String   @default("Queued")
  inputJson   String
  outputJson  String?
  logJson     String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime @default(now())
}

model Artifact {
  id             String            @id @default(cuid())
  projectId      String
  project        Project           @relation(fields: [projectId], references: [id])
  artifactType   String
  title          String
  status         String            @default("Draft")
  currentVersion Int               @default(1)
  contentJson    String
  markdown       String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  versions       ArtifactVersion[]
}

model ArtifactVersion {
  id          String   @id @default(cuid())
  artifactId  String
  artifact    Artifact @relation(fields: [artifactId], references: [id])
  version     Int
  contentJson String
  markdown    String?
  notes       String?
  createdAt   DateTime @default(now())
}
```

---

## 11. Required Output Artifacts

The application must generate multiple work products. Each artifact should be generated first as structured JSON, then rendered as Markdown, DOCX, and/or PPTX.

### 11.1 Impact Statement

Purpose:

- One-page executive review document.
- Designed for CIO, CTO, CFO, and business executive audiences.

Download formats:

- Markdown
- DOCX

Recommended sections:

1. Headline metric banner.
2. Customer Business Problem.
3. How Microsoft Solve It.
4. Impact If Solved.
5. Cost of Inaction.
6. Funding or decision recommendation.

For the OCR to GenAI scenario, the artifact should be able to express business metrics such as:

- 30-50% lower cost per document.
- Straight-through-processing improvement from 65-75% to 90%+.
- Onboarding improvement from 3-8 weeks to 1-5 days.
- Document streams becoming strategic data assets.

### 11.2 Executive Briefing Deck

Purpose:

- PowerPoint-style executive deck.
- Used for executive sponsors and decision makers.

Download formats:

- Markdown slide outline
- PPTX

Recommended slide sequence:

1. Title slide.
2. Why this matters.
3. Current industry or business challenge.
4. Where the legacy process falls short.
5. The AI-powered opportunity.
6. Solution vision and architecture.
7. Technology stack and component roles.
8. Workflow routing and next-best-action model.
9. Operating model and SME engagement.
10. 90-day or phased conversion roadmap.
11. Business value realization.
12. Next steps and decision ask.

### 11.3 Solution Map / Reference Architecture

Purpose:

- Detailed solution design artifact.
- Used by architects, solution engineers, and technical leaders.

Download formats:

- Markdown
- DOCX

Recommended sections:

1. Solution Overview.
2. Reference Architecture at a Glance.
3. Component Roles and Capabilities.
4. Data Flow.
5. Core Processing Capabilities.
6. Workflow Routing and Next Best Action.
7. Engagement Model.
8. Governance, Security, and Responsible AI.
9. Conversion Plan.
10. Accelerated AI-Driven SDLC.
11. Recommended Next Steps.

### 11.4 90-Day Execution Plan

Purpose:

- Workshop output that shows how the concept becomes action.
- Focused on near-term mobilization, execution, governance, and decision gates.

Download formats:

- Markdown
- DOCX

Recommended sections:

1. Executive Objective.
2. Current-State Summary.
3. Target Outcomes.
4. Workstreams.
5. 30/60/90-Day Plan.
6. Resource Model.
7. KPI Framework.
8. Risks and Dependencies.
9. Decision Gates.
10. Follow-up Workshop Actions.

### 11.5 Trends / Art of the Possible White Paper

Purpose:

- Longer-form thought leadership document.
- Used for marketing, business development, or strategy alignment.

Download formats:

- Markdown
- DOCX

Recommended sections:

1. Executive Summary.
2. Industry or Business Landscape.
3. Where the Current Approach Still Works.
4. Where the Current Approach Falls Short.
5. The AI Shift.
6. Art of the Possible.
7. Enterprise Benefits.
8. Risks and Governance.
9. Recommended Next Step.

### 11.6 KPI Framework and Business Case

Purpose:

- Structured metrics artifact used to validate investment.

Download formats:

- Markdown
- DOCX

Recommended sections:

1. KPI Summary.
2. Baseline Metrics.
3. Target Metrics.
4. Measurement Method.
5. Data Sources.
6. Value Hypotheses.
7. Pilot Success Criteria.
8. Executive Review Criteria.

---

## 12. Artifact Generation Requirements

### 12.1 General Requirements

- Every artifact must be grounded in project intake and workshop inputs.
- The app must not invent highly specific financial values unless entered by the user or clearly marked as directional assumptions.
- The app should ask the AI model to distinguish between:
  - Facts provided by the user.
  - Assumptions.
  - Directional benchmarks.
  - Recommendations.
- Every generated artifact must include an â€œAssumptions and Inputs Usedâ€ section in the editable Markdown preview, even if that section is not included in the final executive export.
- Every artifact must be versioned.
- Users must be able to regenerate an artifact with custom instructions.

### 12.2 Tone Requirements

The generated content should be:

- Executive-ready.
- Clear and concise.
- Business-impact oriented.
- Credible and practical.
- Suitable for senior enterprise leaders.
- Not overly technical unless the artifact is a solution map.

### 12.3 Brand and Naming Requirements

Use the product name â€œWorkshop Buddyâ€ in the UI.

Use the tagline:

> Delivering AI-Powered Solution Design at Enterprise Speed

Use this narrative concept in product copy:

> What if enterprise solution design no longer required months of meetings, handoffs, and fragmented alignment?

Use this value statement in product copy:

> AI performs the knowledge work to create the first draft of the artifacts; people provide the judgment, prioritization, oversight, and approval.

---

## 13. Prompt Engineering Requirements

Store prompts under:

```text
src/lib/prompts/
  system.md
  intake-clarification.md
  pain-point-synthesis.md
  business-impact.md
  solution-concept.md
  architecture-solution-map.md
  kpi-value.md
  roadmap.md
  executive-storytelling.md
  artifact-packager.md
  review-quality.md
```

### 13.1 Global System Prompt

Use this as the baseline system prompt for artifact generation:

```text
You are an expert enterprise innovation strategist, solution architect, executive storyteller, and AI transformation advisor. You help Microsoft teams convert live workshop inputs into executive-ready work products.

Your job is to synthesize the provided project context, stakeholder inputs, pain points, outcomes, constraints, risks, and solution ideas into practical, credible, business-impact-oriented artifacts.

Do not invent precise customer facts, financial values, operational metrics, or commitments unless they are provided. If you use assumptions, label them clearly as assumptions. If you use directional target ranges, label them as directional targets.

Write in a polished executive tone. Be specific enough to be useful, but do not overcomplicate the output. Separate facts, assumptions, recommendations, and open questions when appropriate.

Return structured JSON when requested. The JSON must be valid and must match the requested schema.
```

### 13.2 Artifact Packager Prompt Pattern

```text
Create the requested artifact from the project context, workshop inputs, and agent synthesis outputs.

Artifact type: {{artifactType}}
Audience: {{audience}}
Business problem: {{businessProblem}}
Desired outcomes: {{desiredOutcomes}}
Workshop inputs: {{workshopInputs}}
Agent synthesis: {{agentSynthesis}}

Requirements:
1. Use an executive-ready tone.
2. Ground the content in the provided inputs.
3. Clearly label assumptions.
4. Include measurable outcomes where provided.
5. Produce structured JSON with sections.
6. Include a concise title and subtitle.
7. Include recommended next steps.
8. Avoid unsupported precision.
```

### 13.3 Regeneration Prompt Pattern

```text
Revise the existing artifact using the user's instructions.

Existing artifact:
{{artifactMarkdown}}

User revision instructions:
{{revisionInstructions}}

Keep the artifact aligned to the original project context and workshop inputs. Improve clarity, structure, executive tone, and usefulness. Return the full revised artifact as structured JSON and Markdown.
```

---

## 14. API Requirements

Use REST-style API routes.

### 14.1 Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PUT    /api/projects/:projectId
DELETE /api/projects/:projectId
```

### 14.2 Workshop Inputs

```text
GET    /api/projects/:projectId/inputs
POST   /api/projects/:projectId/inputs
PUT    /api/inputs/:inputId
DELETE /api/inputs/:inputId
POST   /api/inputs/:inputId/vote
```

### 14.3 Agent Runs

```text
POST   /api/projects/:projectId/agent-runs
GET    /api/projects/:projectId/agent-runs
GET    /api/agent-runs/:agentRunId
```

`POST /api/projects/:projectId/agent-runs` should accept:

```json
{
  "mode": "full_workflow",
  "artifactTypes": ["Impact Statement", "Executive Briefing Deck"],
  "customInstructions": "Focus on speed to value and executive funding decision."
}
```

### 14.4 Artifacts

```text
GET    /api/projects/:projectId/artifacts
POST   /api/projects/:projectId/artifacts/generate
GET    /api/artifacts/:artifactId
PUT    /api/artifacts/:artifactId
POST   /api/artifacts/:artifactId/regenerate
GET    /api/artifacts/:artifactId/download?format=markdown
GET    /api/artifacts/:artifactId/download?format=docx
GET    /api/artifacts/:artifactId/download?format=pptx
```

---

## 15. Frontend Component Requirements

Suggested component structure:

```text
src/components/
  app-shell.tsx
  dashboard/
    hero-card.tsx
    project-card.tsx
    recent-artifacts.tsx
  projects/
    project-intake-wizard.tsx
    project-summary-card.tsx
  workshop/
    workshop-input-form.tsx
    input-card.tsx
    input-board.tsx
    facilitator-notes.tsx
  agents/
    agent-workflow-canvas.tsx
    agent-status-card.tsx
    agent-run-log.tsx
  artifacts/
    artifact-list.tsx
    artifact-preview.tsx
    artifact-editor.tsx
    artifact-download-buttons.tsx
    artifact-version-history.tsx
  settings/
    ai-provider-settings.tsx
    export-settings.tsx
```

---

## 16. Suggested Project Folder Structure

```text
innovate-impact/
  prisma/
    schema.prisma
    seed.ts
  public/
    logo-placeholder.svg
  src/
    app/
      page.tsx
      dashboard/page.tsx
      projects/page.tsx
      projects/[projectId]/page.tsx
      projects/[projectId]/workshop/page.tsx
      projects/[projectId]/agents/page.tsx
      projects/[projectId]/artifacts/page.tsx
      settings/page.tsx
      api/
        projects/route.ts
        projects/[projectId]/route.ts
        projects/[projectId]/inputs/route.ts
        projects/[projectId]/agent-runs/route.ts
        projects/[projectId]/artifacts/route.ts
        artifacts/[artifactId]/route.ts
        artifacts/[artifactId]/download/route.ts
    components/
    lib/
      ai/
        provider.ts
        azure-openai-provider.ts
        openai-provider.ts
      agents/
        orchestrator.ts
        intake-clarification-agent.ts
        pain-point-synthesis-agent.ts
        business-impact-agent.ts
        solution-concept-agent.ts
        architecture-solution-map-agent.ts
        kpi-value-agent.ts
        roadmap-agent.ts
        executive-storytelling-agent.ts
        artifact-packager-agent.ts
        review-quality-agent.ts
      artifacts/
        markdown-renderer.ts
        docx-renderer.ts
        pptx-renderer.ts
        artifact-schemas.ts
      db.ts
      prompts/
      utils.ts
  data/
    innovateimpact.db
  Dockerfile
  docker-compose.yml
  package.json
  README.md
  .env.example
```

---

## 17. Seed Demo Data

Create a seed project named:

> OCR to GenAI Document Intelligence Modernization

Seed project values:

```json
{
  "projectName": "OCR to GenAI Document Intelligence Modernization",
  "clientName": "Demo Global Logistics Client",
  "industry": "Transportation, Logistics, Freight, and Shipping",
  "businessProblem": "Legacy OCR-based document processing is creating high exception handling costs, long onboarding cycles, limited semantic understanding, and poor visibility into document-driven operations.",
  "desiredOutcomes": [
    "Reduce manual exception handling",
    "Increase straight-through-processing to 90% or higher on anchor document types",
    "Reduce new document layout onboarding from weeks to days",
    "Create a governed analytics layer from document streams",
    "Improve customer and operator experience through AI-assisted workflows"
  ],
  "targetAudience": ["CIO", "CTO", "CFO", "Operations Executive"],
  "selectedArtifacts": [
    "Impact Statement",
    "Executive Briefing Deck",
    "Solution Map",
    "90-Day Execution Plan",
    "Trends White Paper",
    "KPI Framework"
  ]
}
```

Seed workshop inputs:

1. Manual exception handling consumes too much operational capacity.
2. OCR templates break when vendor layouts change.
3. New document types take weeks to onboard.
4. Mobile-captured images create quality issues.
5. Current systems extract characters but do not understand context.
6. Operators need next-best-action recommendations.
7. Executives need measurable business impact before funding modernization.
8. Compliance teams need traceability and audit history.
9. Customers want faster answers and self-service visibility.
10. Leadership wants a practical 90-day plan, not a multi-year transformation proposal.

---

## 18. Document Rendering Requirements

### 18.1 Markdown Renderer

Render structured artifact JSON into clean Markdown.

Each artifact should include:

- Title.
- Subtitle.
- Executive summary.
- Major sections.
- Tables where useful.
- Recommended next steps.
- Assumptions and inputs used.

### 18.2 DOCX Renderer

Use the `docx` package.

DOCX requirements:

- Title page or title block.
- Heading styles.
- Tables for KPI and roadmap sections.
- Bullets and numbered lists.
- Footer with application name and artifact version.
- Optional simple brand color accents.

### 18.3 PPTX Renderer

Use `pptxgenjs`.

PPTX requirements:

- 16:9 widescreen layout.
- Title slide.
- Section title slides where appropriate.
- Consistent typography.
- Executive metric cards.
- Simple architecture flow slides.
- Timeline slide.
- Next steps slide.
- Speaker notes if generated by AI.

Do not attempt to perfectly replicate any uploaded sample design. Instead, create a clean, modern executive briefing deck inspired by the structure of the sample artifacts.

---

## 19. Agent Orchestration Logic

Implement an orchestrator in `src/lib/agents/orchestrator.ts`.

Pseudo-flow:

```ts
export async function runInnovationWorkflow(projectId: string, options: RunOptions) {
  const project = await getProject(projectId);
  const inputs = await getWorkshopInputs(projectId);

  const intake = await runIntakeClarificationAgent(project, inputs);
  const painPoints = await runPainPointSynthesisAgent(project, inputs, intake);
  const businessImpact = await runBusinessImpactAgent(project, inputs, painPoints);
  const solutionConcept = await runSolutionConceptAgent(project, inputs, painPoints, businessImpact);
  const architecture = await runArchitectureSolutionMapAgent(project, inputs, solutionConcept);
  const kpis = await runKpiValueAgent(project, inputs, businessImpact);
  const roadmap = await runRoadmapAgent(project, inputs, solutionConcept, kpis);
  const executiveStory = await runExecutiveStorytellingAgent(project, inputs, businessImpact, solutionConcept, roadmap);

  const artifacts = await runArtifactPackagerAgent({
    project,
    inputs,
    synthesis: {
      intake,
      painPoints,
      businessImpact,
      solutionConcept,
      architecture,
      kpis,
      roadmap,
      executiveStory
    },
    requestedArtifactTypes: options.artifactTypes
  });

  const review = await runReviewQualityAgent(project, inputs, artifacts);

  await saveAgentRun(projectId, { intake, painPoints, businessImpact, solutionConcept, architecture, kpis, roadmap, executiveStory, artifacts, review });
  await saveArtifacts(projectId, artifacts);

  return { artifacts, review };
}
```

---

## 20. Human-in-the-Loop Requirements

The app must make clear that AI generates drafts and humans approve final work products.

Required features:

- Artifact status: Draft, In Review, Approved, Archived.
- Regenerate with user guidance.
- Editable Markdown preview.
- Assumptions section.
- Quality Agent review notes.
- Version history.

Stretch goal:

- Approval workflow with named reviewer.

---

## 21. Error Handling Requirements

The application should handle:

- Missing AI configuration.
- AI generation failure.
- Invalid JSON returned by model.
- Document generation failure.
- Empty workshop inputs.
- Database connection failure.

For invalid model JSON:

- Retry once with a JSON repair prompt.
- If still invalid, save the raw response and show a useful error in the UI.

For missing AI configuration:

- Show a clear settings message and allow the user to continue exploring the seeded demo content.

---

## 22. Security and Governance Requirements for Demo

MVP security should be lightweight but credible.

Required:

- Store secrets only in environment variables.
- Do not write API keys to logs.
- Add a simple demo disclaimer that generated content must be reviewed before client use.
- Keep generated artifacts scoped to a project.
- Include responsible AI language in artifact assumptions.

Optional:

- Simple password gate for demo.
- Azure Entra ID authentication in future version.

---

## 23. Azure Container Apps Deployment Requirements

The application must include:

- Dockerfile.
- `.env.example`.
- README deployment steps.
- Health endpoint at `/api/health`.
- Container listens on port 3000.

### 23.1 Dockerfile Requirements

Use a production Next.js Dockerfile pattern.

The Docker image must:

- Install dependencies.
- Generate Prisma client.
- Build Next.js app.
- Run database migrations or provide a startup command option.
- Start the server.

### 23.2 Local Docker Compose

Include `docker-compose.yml` for local testing.

Services:

- `web` for the Next.js app.
- Optional `db` only if using a non-SQLite provider.

### 23.3 Azure SQL Option

The app should support swapping SQLite for Azure SQL later by updating:

```bash
DATABASE_URL="sqlserver://..."
```

For the MVP, SQLite is acceptable.

---

## 24. Acceptance Criteria

The MVP is complete when:

1. A user can create a new project.
2. A user can enter business problem details and desired outcomes.
3. A user can add workshop input cards.
4. A user can run the AI workflow.
5. The app saves the agent run.
6. The app creates at least these artifacts:
   - Impact Statement
   - Executive Briefing Deck
   - Solution Map
   - 90-Day Execution Plan
7. The user can preview generated artifacts in the app.
8. The user can edit generated Markdown.
9. The user can download DOCX outputs for document-style artifacts.
10. The user can download a PPTX output for the executive briefing deck.
11. The app includes the seeded OCR to GenAI demo project.
12. The app can run locally with `npm run dev`.
13. The app can be built and run as a Docker container.
14. The README explains local setup and Azure Container Apps deployment.

---

## 25. Development Phases for GitHub Copilot

Build the app in phases.

### Phase 1: Foundation

- Create Next.js app with TypeScript and Tailwind.
- Add shadcn/ui style components.
- Add Prisma with SQLite.
- Create database schema and seed data.
- Build dashboard and project screens.

### Phase 2: Workshop Studio

- Add project intake wizard.
- Add workshop input board.
- Add input categories, priorities, personas, and voting.

### Phase 3: AI Workflow

- Add AI provider abstraction.
- Add prompt files.
- Implement basic agent orchestrator.
- Save agent runs.
- Display agent workflow status.

### Phase 4: Artifact Generation

- Generate structured artifact JSON.
- Render Markdown previews.
- Add artifact versioning.
- Add regeneration with custom instructions.

### Phase 5: Downloads

- Implement DOCX generation.
- Implement PPTX generation.
- Add download endpoints.

### Phase 6: Polish and Deployment

- Improve UI polish.
- Add error handling.
- Add Dockerfile.
- Add README and `.env.example`.
- Add `/api/health`.

---

## 26. Example UI Copy

Hero copy:

> Workshop Buddy turns live discovery conversations into executive-ready solution artifacts in minutes.

Subcopy:

> Capture pain points, align outcomes, run AI-powered solution design agents, and generate impact statements, roadmaps, executive briefings, and implementation plans â€” all from one guided workshop experience.

Workshop screen helper text:

> Add stakeholder inputs as they emerge. The AI workflow will synthesize these notes into business impact, solution architecture, KPIs, roadmap, and executive-ready artifacts.

Agent workflow helper text:

> AI is generating the first draft. Human review and approval remain required before client use.

Artifact screen helper text:

> Review, edit, regenerate, approve, and download the work products created from this workshop.

---

## 27. Non-Goals for MVP

Do not build the following in the MVP unless there is extra time:

- Full enterprise identity and RBAC.
- Multi-tenant production isolation.
- Complex real-time collaboration infrastructure.
- Native integration with Microsoft Teams.
- Native integration with Microsoft Fabric or Azure AI Search.
- Full PowerPoint design system matching corporate templates.
- Full PDF rendering pipeline.
- Complex approval routing engine.

The MVP should prove the concept: structured workshop inputs plus AI agentic workflows can rapidly create useful, downloadable business and solution design work products.

---

## 28. Future Enhancements

Potential next-version capabilities:

- Microsoft Entra ID authentication.
- Role-based access control.
- Microsoft Teams meeting integration.
- Live participant join by QR code.
- Real-time collaboration using WebSockets.
- Azure Blob Storage for generated documents.
- Azure SQL as default database.
- Azure AI Search over past projects and artifacts.
- Microsoft Graph integration for calendar/workshop scheduling.
- Export to branded corporate PowerPoint templates.
- Approval routing through Teams or email.
- Retrieval over uploaded source documents.
- Integration with Microsoft Fabric for KPI reporting.
- Portfolio dashboard across multiple innovation projects.

---

## 29. Build Instruction for GitHub Copilot

Use this specification to build a working MVP of Workshop Buddy.

Prioritize a polished, working demo over enterprise completeness. The user should be able to run the app locally, open the seeded OCR to GenAI project, add or edit workshop inputs, run the AI workflow, preview generated artifacts, and download Word and PowerPoint outputs.

Keep the code modular, readable, and easy to extend. Use structured JSON internally for all AI outputs. Save all projects, inputs, agent runs, and artifacts in the database. Include clear setup instructions and environment variable examples.


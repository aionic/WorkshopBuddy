/**
 * Agent orchestrator. Implements the 10 specialized agents described in the
 * spec. When a live AI provider is configured each agent uses it; otherwise
 * deterministic fallbacks produce credible demo content grounded in the
 * project intake and workshop inputs.
 */
import fs from "node:fs";
import path from "node:path";
import { getAIProvider, isLiveAIConfigured } from "../ai/provider";
import type { ArtifactContent, ArtifactType } from "../artifacts/artifact-schemas";
import { ARTIFACT_PREREQUISITES } from "../artifacts/artifact-schemas";
import { renderMarkdown } from "../artifacts/markdown-renderer";
import {
  SYNTHESIS_AGENTS,
  ARTIFACT_PACKAGER_AGENT,
  APPLICATION_SPEC_AGENT,
  REVIEW_AGENT,
  type AgentDefinition
} from "./agent-prompts";

type Project = {
  id: string;
  name: string;
  clientName?: string | null;
  industry?: string | null;
  businessProblem: string;
  desiredOutcomes: string;
  targetAudience: string;
  selectedArtifacts: string;
  timeHorizon?: string | null;
};

type Input = {
  id: string;
  category: string;
  persona?: string | null;
  priority: string;
  content: string;
  votes: number;
};

const PROMPTS_DIR = path.join(process.cwd(), "src", "lib", "prompts");
function loadPrompt(name: string): string {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, name), "utf-8");
  } catch {
    return "";
  }
}

export interface AgentResult {
  name: string;
  status: "Completed" | "Failed";
  summary: string;
  output: unknown;
  error?: string;
  /** True if this agent's output came from a live LLM call. */
  usedLLM?: boolean;
  /** If usedLLM is false but useLive was on, this is the LLM error. */
  llmError?: string;
  /** End-to-end duration in ms (LLM call + JSON parsing). */
  durationMs?: number;
}

export interface SynthesisBundle {
  intake: any;
  painPoints: any;
  businessImpact: any;
  solutionConcept: any;
  architecture: any;
  kpis: any;
  roadmap: any;
  executiveStory: any;
}

export interface OrchestrationResult {
  agents: AgentResult[];
  synthesis: SynthesisBundle;
  artifacts: Array<{ artifactType: ArtifactType; content: ArtifactContent; markdown: string }>;
  review: {
    qualityScore: number;
    missingSections: string[];
    suggestedEdits: string[];
    consistencyFindings?: string[];
    perArtifactScores?: Array<{ artifactType: string; score: number; gaps: string[] }>;
  };
  usedLiveAI: boolean;
}

function safeJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function runAgent<T>(name: string, fn: () => Promise<T | { __agent: true; output: T; usedLLM: boolean; llmError?: string }>): Promise<AgentResult> {
  const start = Date.now();
  try {
    const raw = await fn();
    // Allow the caller to attach LLM diagnostics by returning a wrapped object.
    if (raw && typeof raw === "object" && (raw as any).__agent === true) {
      const w = raw as { output: T; usedLLM: boolean; llmError?: string };
      return {
        name,
        status: "Completed",
        summary: summarize(name, w.output),
        output: w.output,
        usedLLM: w.usedLLM,
        llmError: w.llmError,
        durationMs: Date.now() - start
      };
    }
    return { name, status: "Completed", summary: summarize(name, raw), output: raw, durationMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      status: "Failed",
      summary: `Agent failed: ${(err as Error).message}`,
      output: null,
      error: (err as Error).message,
      durationMs: Date.now() - start
    };
  }
}

function summarize(name: string, output: any): string {
  if (!output) return `${name} returned no output`;
  if (Array.isArray(output)) return `${name} produced ${output.length} items`;
  if (typeof output === "object") {
    const keys = Object.keys(output);
    return `${name} produced ${keys.length} fields: ${keys.slice(0, 4).join(", ")}`;
  }
  return `${name} completed`;
}

// ----- Deterministic fallbacks (grounded in inputs) -----

function clusterByCategory(inputs: Input[]) {
  const m: Record<string, Input[]> = {};
  for (const i of inputs) (m[i.category] ||= []).push(i);
  return m;
}

function fallbackIntake(project: Project, inputs: Input[]) {
  const outcomes = safeJson<string[]>(project.desiredOutcomes) ?? [];
  return {
    refinedProblem: project.businessProblem,
    outcomeStatement: outcomes.length ? `Deliver: ${outcomes.join("; ")}.` : "Reduce cost, increase speed, and create new analytics value.",
    assumptions: [
      "Workshop inputs are representative of the broader operating environment.",
      "Modernization targets are directional, to be validated with baseline data."
    ],
    openQuestions: inputs.length < 5 ? ["What are current baseline metrics for cost per document and STP rate?"] : []
  };
}

function fallbackPainPoints(inputs: Input[]) {
  const clusters = clusterByCategory(inputs.filter((i) => /pain|bottleneck|constraint|impact|risk/i.test(i.category)));
  return Object.entries(clusters).map(([theme, items]) => ({
    theme,
    severity: items.some((i) => i.priority === "Critical") ? "Critical" : items.some((i) => i.priority === "High") ? "High" : "Medium",
    stakeholders: Array.from(new Set(items.map((i) => i.persona).filter(Boolean))),
    evidence: items.map((i) => i.content)
  }));
}

function fallbackBusinessImpact(project: Project) {
  return {
    costDrivers: ["Manual exception handling labor", "Long onboarding cycles for new layouts", "Rework from low-confidence OCR extractions"],
    revenueOpportunities: ["Faster customer response improves retention", "New analytics products on top of document streams"],
    productivityImpacts: ["Operators redirected from data entry to exception adjudication and decisions"],
    customerExperienceImpacts: ["Faster turnaround and self-service visibility"],
    riskImpacts: ["Audit and compliance gaps from inconsistent template-based extraction"],
    costOfInaction: `Continuing with legacy OCR for ${project.clientName ?? "the organization"} sustains high per-document cost and slows new revenue and analytics opportunities.`
  };
}

function fallbackSolutionConcept() {
  return {
    vision: "Replace template-bound OCR with a governed GenAI document intelligence platform that understands documents in context.",
    capabilities: [
      "Layout-agnostic extraction with Azure AI Document Intelligence",
      "Semantic understanding and reasoning with Azure OpenAI",
      "Hybrid search and grounding via Azure AI Search and OneLake",
      "Human-in-the-loop adjudication via Copilot Studio and Teams",
      "Governance, lineage, and policy with Microsoft Purview and Content Safety"
    ],
    technologyComponents: [
      "Azure AI Document Intelligence",
      "Azure AI Vision",
      "Azure OpenAI",
      "Microsoft Fabric / OneLake",
      "Azure AI Search",
      "Logic Apps / Power Automate",
      "Copilot Studio",
      "Microsoft Teams",
      "Microsoft Purview",
      "Azure AI Content Safety"
    ],
    humanInTheLoop: "Operators adjudicate low-confidence and high-risk cases via Copilot in Teams with full lineage.",
    dataAndWorkflow: "Documents land in OneLake; AI services classify, extract, summarize, and route; analytics layer publishes governed KPIs."
  };
}

function fallbackArchitecture() {
  return {
    stages: ["Ingest", "Classify", "Extract & Reason", "Adjudicate", "Publish & Analyze"],
    components: [
      { name: "Ingestion", role: "Capture documents from scanners, email, mobile, and API." },
      { name: "Classification", role: "Vision + LLM classify document type and route." },
      { name: "Extraction & Reasoning", role: "Document Intelligence + Azure OpenAI extract fields and reason across pages." },
      { name: "Adjudication", role: "Copilot Studio + Teams for human-in-the-loop exception handling." },
      { name: "Publish & Analyze", role: "OneLake + Fabric for governed KPIs and downstream analytics." }
    ],
    governance: "Purview lineage, Content Safety filters, audit trail per document and per decision."
  };
}

function fallbackKpis() {
  return {
    kpis: [
      { metric: "Cost per document", baseline: "100 (index)", target: "50-70 (index)", method: "Workflow + finance baseline" },
      { metric: "Straight-through processing", baseline: "65-75%", target: "≥ 90% on anchor types", method: "Pipeline telemetry" },
      { metric: "New layout onboarding", baseline: "3-8 weeks", target: "1-5 days", method: "Onboarding lead-time tracker" },
      { metric: "Operator time on exceptions", baseline: "Index 100", target: "30-50% reduction", method: "Workforce analytics" }
    ],
    valueSummary: "Directional targets pending baseline validation in the discovery phase."
  };
}

function fallbackRoadmap() {
  return {
    plan: {
      days0to30: ["Establish baseline metrics", "Select 2-3 anchor document types", "Stand up Azure landing zone and OneLake medallion", "Define adjudication policy"],
      days31to60: ["Build classification + extraction MVP on anchor types", "Integrate Copilot Studio adjudication in Teams", "Wire governed analytics in Fabric"],
      days61to90: ["Pilot live traffic with shadow mode", "Measure KPIs vs. baseline", "Decide scale-out plan and funding"]
    },
    workstreams: ["Platform", "Data & Governance", "AI Engineering", "Operations Adoption", "Value Realization"],
    decisionGates: ["Pilot scope approval (Day 15)", "MVP demo (Day 45)", "Scale decision (Day 90)"]
  };
}

function fallbackExecStory(project: Project) {
  return {
    summary: `${project.clientName ?? "The organization"} can move from template-bound OCR to a governed GenAI document intelligence platform, lowering cost per document, raising straight-through processing, shortening layout onboarding, and creating new analytics value within a measurable 90-day plan.`,
    storyline: [
      "Why this matters now",
      "Where legacy OCR falls short",
      "The AI-powered opportunity",
      "Solution vision and architecture",
      "Operating model with human-in-the-loop",
      "90-day execution plan",
      "Business value realization",
      "Decision ask"
    ]
  };
}

// ----- Live AI agent helper -----

/**
 * Build the full system prompt for an agent: shared base persona from
 * `system.md` + the agent-specific instructions defined in agent-prompts.ts.
 */
function composeSystemPrompt(def: AgentDefinition): string {
  const base = loadPrompt("system.md") || "You are a senior enterprise innovation strategist.";
  return `${base}\n\n---\nRole for this turn: ${def.role}\n\n${def.systemPrompt}`;
}

/**
 * Build the user prompt: agent context + labeled upstream handoff payloads +
 * optional facilitator-provided custom instructions + the JSON schema hint.
 *
 * Upstream agent outputs are surfaced as `upstream.<camelCaseAgentName>` keys
 * so each sub-agent can read its prerequisites by name rather than mining an
 * opaque blob. Only the upstream slices named in `def.dependsOn` are included.
 *
 * Custom instructions are passed through to every agent so workshop
 * facilitators can steer the entire run.
 */
function composeUserPrompt(
  def: AgentDefinition,
  contextJson: string,
  customInstructions?: string,
  extra?: string,
  upstream?: Record<string, unknown>
): string {
  const parts = [`Agent: ${def.name}`, `Context (JSON):\n${contextJson}`];
  if (upstream && Object.keys(upstream).length > 0) {
    parts.push(`Upstream agent outputs (read these first; treat as source of truth):\n${JSON.stringify({ upstream }, null, 2)}`);
  }
  if (extra) parts.push(extra);
  if (customInstructions && customInstructions.trim()) {
    parts.push(`Additional facilitator instructions to apply across the engagement:\n${customInstructions.trim()}`);
  }
  parts.push(`Return ONLY valid JSON matching this schema: ${def.schemaHint}`);
  return parts.join("\n\n");
}

/**
 * Map an agent display name (e.g. "Pain Point Synthesis Agent") to the
 * camelCase key used in `upstream.<name>` handoff payloads
 * (e.g. "painPointSynthesis"). Mirrors the names used in agent-prompts.ts
 * dependsOn fields and in this module's persona-card documentation.
 */
function upstreamKeyForAgent(agentName: string): string {
  const stripped = agentName.replace(/\s+Agent$/i, "").trim();
  const words = stripped.split(/\s+/);
  if (words.length === 0) return stripped;
  const head = words[0].toLowerCase();
  const tail = words
    .slice(1)
    .filter((w) => w.toLowerCase() !== "and")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return head + tail;
}

/**
 * Build the labeled upstream handoff payload for a given agent. Returns only
 * the upstream slices declared in `def.dependsOn`, keyed by camelCase agent
 * name. Missing upstream entries are surfaced as `null` so the sub-agent can
 * follow its escape-hatch policy.
 */
function buildUpstreamHandoff(
  def: AgentDefinition,
  upstreamOutputs: Map<string, unknown>
): { handoff: Record<string, unknown>; missing: string[] } {
  const handoff: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const depName of def.dependsOn ?? []) {
    const key = upstreamKeyForAgent(depName);
    if (upstreamOutputs.has(depName)) {
      handoff[key] = upstreamOutputs.get(depName);
    } else {
      handoff[key] = null;
      missing.push(depName);
    }
  }
  return { handoff, missing };
}

/**
 * Run an agent: try the live provider with the agent-specific prompt; if it
 * fails or no provider is configured, return the deterministic fallback so
 * the workflow always completes. Diagnostics about whether the LLM was
 * actually used are propagated up so the UI can surface them.
 */
async function executeAgent<T>(
  def: AgentDefinition,
  contextJson: string,
  fallback: () => T,
  options: {
    useLive: boolean;
    customInstructions?: string;
    extraUserPrompt?: string;
    upstream?: Record<string, unknown>;
  } = { useLive: false }
): Promise<AgentResult> {
  return runAgent(def.name, async () => {
    if (!options.useLive) {
      return { __agent: true as const, output: fallback(), usedLLM: false };
    }
    try {
      const system = composeSystemPrompt(def);
      const user = composeUserPrompt(def, contextJson, options.customInstructions, options.extraUserPrompt, options.upstream);
      const output = await getAIProvider().generateStructuredJson<T>(user, system);
      return { __agent: true as const, output, usedLLM: true };
    } catch (err) {
      const llmError = (err as Error).message;
      console.warn(`[orchestrator] LLM call failed for "${def.name}": ${llmError}`);
      return { __agent: true as const, output: fallback(), usedLLM: false, llmError };
    }
  });
}

function contextString(project: Project, inputs: Input[], extra?: Record<string, unknown>) {
  return JSON.stringify(
    {
      project: {
        name: project.name,
        client: project.clientName,
        industry: project.industry,
        businessProblem: project.businessProblem,
        desiredOutcomes: safeJson<string[]>(project.desiredOutcomes),
        targetAudience: safeJson<string[]>(project.targetAudience),
        timeHorizon: project.timeHorizon
      },
      inputs: inputs.map((i) => ({ category: i.category, persona: i.persona, priority: i.priority, content: i.content, votes: i.votes })),
      ...(extra ?? {})
    },
    null,
    2
  );
}

// ----- Artifact assembly -----

function buildArtifact(type: ArtifactType, project: Project, inputs: Input[], s: SynthesisBundle): ArtifactContent {
  const outcomes = safeJson<string[]>(project.desiredOutcomes) ?? [];
  const audience = safeJson<string[]>(project.targetAudience) ?? [];
  const assumptions: string[] = [
    ...(s.intake?.assumptions ?? []),
    "Directional metrics will be validated against baseline data captured in the first 30 days."
  ];

  switch (type) {
    case "Impact Statement":
      return {
        title: `${project.name}: Executive Impact Statement`,
        subtitle: "Modernizing document operations with governed AI",
        metrics: [
          { label: "Cost per document", value: "−30 to −50%", subtext: "directional target" },
          { label: "Straight-through processing", value: "≥ 90%", subtext: "anchor document types" },
          { label: "New layout onboarding", value: "Weeks → days", subtext: "from 3-8 weeks to 1-5 days" },
          { label: "Document streams", value: "Strategic data assets", subtext: "governed analytics layer" }
        ],
        sections: [
          { heading: "Customer Business Problem", content: project.businessProblem },
          { heading: "How Microsoft Solves It", content: s.solutionConcept.vision + "\n\nCore components: " + s.solutionConcept.technologyComponents.join(", ") + "." },
          { heading: "Impact If Solved", content: bullets([...outcomes, ...s.businessImpact.productivityImpacts, ...s.businessImpact.customerExperienceImpacts]) },
          { heading: "Cost of Inaction", content: s.businessImpact.costOfInaction },
          { heading: "Funding and Decision Recommendation", content: "Authorize a 90-day pilot on 2-3 anchor document types with measurable KPIs and a scale decision gate at Day 90." }
        ],
        assumptions,
        nextSteps: ["Confirm anchor document types", "Authorize Day-0 baseline capture", "Approve Day-90 scale gate criteria"]
      };

    case "Executive Briefing Deck":
      return {
        title: project.name,
        subtitle: "Executive Briefing — AI-Powered Document Intelligence",
        sections: [
          { heading: "Why this matters", content: s.executiveStory.summary },
          { heading: "Current challenge", content: bullets(s.painPoints.slice(0, 6).map((p: any) => `${p.theme}: ${p.evidence?.[0] ?? ""}`)) },
          { heading: "Where legacy OCR falls short", content: bullets(s.businessImpact.costDrivers) },
          { heading: "The AI-powered opportunity", content: s.solutionConcept.vision },
          { heading: "Solution vision & architecture", content: bullets(s.architecture.stages.map((st: string, i: number) => `${i + 1}. ${st}`)) },
          { heading: "Technology stack", content: bullets(s.solutionConcept.technologyComponents) },
          { heading: "Workflow & next-best-action", content: s.solutionConcept.humanInTheLoop },
          { heading: "Operating model & SME engagement", content: "Operators shift from data entry to adjudication and exception decisioning. Copilot in Teams provides next-best-action with full lineage." },
          { heading: "90-day conversion roadmap", content: bullets([
              `Days 0-30: ${(s.roadmap.plan.days0to30 as string[]).join("; ")}`,
              `Days 31-60: ${(s.roadmap.plan.days31to60 as string[]).join("; ")}`,
              `Days 61-90: ${(s.roadmap.plan.days61to90 as string[]).join("; ")}`
            ]) },
          { heading: "Business value realization", content: bullets((s.kpis.kpis as any[]).map((k) => `${k.metric}: ${k.baseline} → ${k.target}`)) },
          { heading: "Next steps & decision ask", content: bullets(["Approve pilot scope and funding", "Endorse anchor document types", "Commit executive sponsor and steering cadence"]) }
        ],
        metrics: [
          { label: "Cost / doc", value: "−30 to −50%" },
          { label: "STP", value: "≥ 90%" },
          { label: "Onboarding", value: "Weeks → days" },
          { label: "Audience", value: audience.join(", ") || "Executive" }
        ],
        assumptions,
        nextSteps: ["Approve pilot scope", "Confirm executive sponsor", "Schedule Day-15 gate review"]
      };

    case "Solution Map":
      return {
        title: `${project.name}: Solution Map and Reference Architecture`,
        subtitle: "Reference architecture and operating model",
        sections: [
          { heading: "Solution Overview", content: s.solutionConcept.vision },
          { heading: "Reference Architecture at a Glance", content: bullets(s.architecture.stages.map((st: string, i: number) => `${i + 1}. ${st}`)) },
          { heading: "Component Roles and Capabilities", content: bullets((s.architecture.components as any[]).map((c) => `${c.name}: ${c.role}`)) },
          { heading: "Data Flow", content: s.solutionConcept.dataAndWorkflow },
          { heading: "Core Processing Capabilities", content: bullets(s.solutionConcept.capabilities) },
          { heading: "Workflow Routing and Next Best Action", content: s.solutionConcept.humanInTheLoop },
          { heading: "Engagement Model", content: "Joint Microsoft squad with SME pods from operations, IT, and compliance." },
          { heading: "Governance, Security, and Responsible AI", content: s.architecture.governance },
          { heading: "Conversion Plan", content: bullets([
              `Days 0-30: ${(s.roadmap.plan.days0to30 as string[]).join("; ")}`,
              `Days 31-60: ${(s.roadmap.plan.days31to60 as string[]).join("; ")}`,
              `Days 61-90: ${(s.roadmap.plan.days61to90 as string[]).join("; ")}`
            ]) },
          { heading: "Accelerated AI-Driven SDLC", content: "Use GitHub Copilot, Azure AI Foundry templates, and reusable agent patterns to compress build cycles." },
          { heading: "Recommended Next Steps", content: bullets(["Confirm anchor document types", "Stand up landing zone", "Begin baseline metric capture"]) }
        ],
        assumptions,
        nextSteps: ["Lock anchor types", "Approve landing zone IaC", "Confirm governance owners"]
      };

    case "90-Day Execution Plan":
      return {
        title: `${project.name}: 90-Day Execution Plan`,
        subtitle: "From concept to measured value in 90 days",
        sections: [
          { heading: "Executive Objective", content: s.executiveStory.summary },
          { heading: "Current-State Summary", content: bullets(s.painPoints.slice(0, 6).map((p: any) => `${p.theme} (${p.severity})`)) },
          { heading: "Target Outcomes", content: bullets(outcomes) },
          { heading: "Workstreams", content: bullets(s.roadmap.workstreams) },
          { heading: "30-Day Plan", content: bullets(s.roadmap.plan.days0to30) },
          { heading: "60-Day Plan", content: bullets(s.roadmap.plan.days31to60) },
          { heading: "90-Day Plan", content: bullets(s.roadmap.plan.days61to90) },
          { heading: "Resource Model", content: "Joint Microsoft squad with embedded SMEs across operations, IT, and compliance." },
          { heading: "KPI Framework", content: bullets((s.kpis.kpis as any[]).map((k) => `${k.metric}: ${k.baseline} → ${k.target} (${k.method})`)) },
          { heading: "Risks and Dependencies", content: bullets(s.businessImpact.riskImpacts) },
          { heading: "Decision Gates", content: bullets(s.roadmap.decisionGates) },
          { heading: "Follow-up Workshop Actions", content: bullets(["Capture baseline metrics", "Confirm SME participation", "Approve scope and funding"]) }
        ],
        assumptions,
        nextSteps: ["Schedule Day-15 gate review", "Stand up shared backlog", "Confirm executive sponsor"]
      };

    case "Trends White Paper":
      return {
        title: `From OCR to AI: ${project.industry ?? "Industry"} Document Intelligence`,
        subtitle: "Art of the possible — modernizing document operations with governed AI",
        sections: [
          { heading: "Executive Summary", content: s.executiveStory.summary },
          { heading: "Industry or Business Landscape", content: `In ${project.industry ?? "the industry"}, document volumes continue to grow across scanned, emailed, and mobile-captured channels.` },
          { heading: "Where the Current Approach Still Works", content: "Template-driven OCR still performs on stable, high-volume forms with predictable layouts." },
          { heading: "Where the Current Approach Falls Short", content: bullets(s.businessImpact.costDrivers) },
          { heading: "The AI Shift", content: s.solutionConcept.vision },
          { heading: "Art of the Possible", content: bullets(s.solutionConcept.capabilities) },
          { heading: "Enterprise Benefits", content: bullets([...s.businessImpact.productivityImpacts, ...s.businessImpact.customerExperienceImpacts, ...s.businessImpact.revenueOpportunities]) },
          { heading: "Risks and Governance", content: s.architecture.governance },
          { heading: "Recommended Next Step", content: "Authorize a structured 90-day pilot with measurable KPIs and a decision gate." }
        ],
        assumptions,
        nextSteps: ["Identify anchor scenarios", "Define success metrics", "Launch the pilot"]
      };

    case "KPI Framework":
      return {
        title: `${project.name}: KPI Framework and Business Case`,
        subtitle: "Measuring value from AI-powered document intelligence",
        sections: [
          { heading: "KPI Summary", content: bullets((s.kpis.kpis as any[]).map((k) => `${k.metric}: ${k.baseline} → ${k.target}`)) },
          { heading: "Baseline Metrics", content: "To be captured in the first 30 days of the pilot." },
          { heading: "Target Metrics", content: bullets((s.kpis.kpis as any[]).map((k) => `${k.metric}: target ${k.target}`)) },
          { heading: "Measurement Method", content: bullets((s.kpis.kpis as any[]).map((k) => `${k.metric}: ${k.method}`)) },
          { heading: "Data Sources", content: bullets(["Pipeline telemetry", "Workforce analytics", "Finance baseline", "Onboarding lead-time tracker"]) },
          { heading: "Value Hypotheses", content: bullets(s.businessImpact.revenueOpportunities) },
          { heading: "Pilot Success Criteria", content: bullets(["≥ 90% STP on anchor types", "≥ 30% cost reduction trajectory", "Onboarding new layouts in days"]) },
          { heading: "Executive Review Criteria", content: bullets(["Quantified value realization plan", "Governance and risk attestation", "Scale-out funding ask"]) }
        ],
        assumptions,
        nextSteps: ["Lock measurement plan", "Instrument pipeline", "Schedule monthly value review"]
      };

    case "Application Spec":
      return buildApplicationSpecFallback(project, s, assumptions);
  }
}

function bullets(items: string[] | undefined): string {
  if (!items || !items.length) return "";
  return items.map((i) => `- ${i}`).join("\n");
}

/**
 * Deterministic fallback for the Application Spec artifact. Used when the live
 * LLM is not configured or when the Application Spec Agent's call fails. The
 * content is grounded in the synthesis bundle (especially solutionConcept and
 * architecture, which mirror the Solution Map artifact).
 */
function buildApplicationSpecFallback(project: Project, s: SynthesisBundle, assumptions: string[]): ArtifactContent {
  const tech: string[] = (s.solutionConcept?.technologyComponents as string[]) ?? [];
  const stages: string[] = (s.architecture?.stages as string[]) ?? [];
  const components: Array<{ name: string; role: string }> = (s.architecture?.components as any[]) ?? [];
  const capabilities: string[] = (s.solutionConcept?.capabilities as string[]) ?? [];

  return {
    title: `${project.name}: Application Spec (Vibe Coding Brief)`,
    subtitle: "Developer-ready prototype spec for VS Code + GitHub Copilot",
    sections: [
      {
        heading: "Application Overview",
        content:
          "Recommended app type: **Next.js 14 (App Router) + TypeScript** full-stack web app with a Tailwind + shadcn/ui frontend, Prisma + Postgres data layer, and server-side API routes that call Azure AI services.\n\nThe prototype demonstrates the end-to-end Solution Map flow on a laptop: ingest sample documents, classify and extract with Azure AI, route low-confidence items to a human-in-the-loop adjudication queue, and publish governed KPIs to a dashboard."
      },
      {
        heading: "Why This App Type",
        content:
          "A single Next.js codebase covers the operator UI, adjudication queue, and admin dashboard while keeping server-side calls to Azure OpenAI and Document Intelligence behind API routes. It maps cleanly to the Solution Map stages (" +
          (stages.join(" \u2192 ") || "Ingest \u2192 Classify \u2192 Extract \u2192 Adjudicate \u2192 Publish") +
          ") and is trivially deployable to Azure Container Apps or Azure App Service when the prototype graduates."
      },
      {
        heading: "Recommended Technology Stack",
        content: bullets([
          "Frontend: Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS, shadcn/ui, lucide-react icons",
          "Backend: Next.js Route Handlers (Node 20), Zod for validation",
          "Data: Prisma ORM \u2192 Azure Database for PostgreSQL (local: SQLite or Postgres in Docker)",
          "AI services: " + (tech.length ? tech.join(", ") : "Azure OpenAI, Azure AI Document Intelligence, Azure AI Search"),
          "Auth: Microsoft Entra ID via NextAuth (local: dev bypass)",
          "Infra: Azure Container Apps + Azure Container Registry; Bicep IaC; managed identity for Azure AI access",
          "Observability: OpenTelemetry \u2192 Azure Application Insights",
          "Dev tooling: pnpm, ESLint, Prettier, Vitest, Playwright, Docker Desktop"
        ])
      },
      {
        heading: "High-Level Architecture",
        content:
          (components.length
            ? bullets(components.map((c) => `${c.name}: ${c.role}`))
            : "See Solution Map for the full reference architecture.") +
          "\n\n```\n[Browser] \u2192 [Next.js App] \u2192 [API routes] \u2192 [Azure AI services]\n                              \u2193\n                          [Postgres]\n                              \u2193\n                       [Adjudication queue]\n```"
      },
      {
        heading: "Data Model",
        content:
          "Core entities: `Document`, `ExtractionResult`, `AdjudicationCase`, `User`, `KpiSnapshot`.\n\n```prisma\nmodel Document {\n  id          String   @id @default(cuid())\n  source      String\n  type        String?\n  status      String   // ingested|classified|extracted|adjudicated|published\n  createdAt   DateTime @default(now())\n  extractions ExtractionResult[]\n}\n\nmodel ExtractionResult {\n  id         String   @id @default(cuid())\n  documentId String\n  fields     Json\n  confidence Float\n  document   Document @relation(fields: [documentId], references: [id])\n}\n```"
      },
      {
        heading: "API Surface",
        content: bullets([
          "POST /api/documents \u2014 upload a document, returns id and initial status",
          "GET /api/documents/:id \u2014 fetch document + latest extraction",
          "POST /api/documents/:id/classify \u2014 run classification",
          "POST /api/documents/:id/extract \u2014 run Azure AI extraction",
          "GET /api/adjudication \u2014 list low-confidence cases",
          "POST /api/adjudication/:id/decision \u2014 operator approves or corrects",
          "GET /api/kpis \u2014 rollup metrics for dashboard"
        ])
      },
      {
        heading: "Core Features (MVP)",
        content: bullets(
          (capabilities.length ? capabilities : [
            "Document ingest with drag-and-drop and sample dataset",
            "Auto-classification and field extraction",
            "Confidence-aware adjudication queue",
            "Operator decision capture with audit trail",
            "KPI dashboard (cost / doc, STP rate, onboarding time)"
          ]).slice(0, 7).map((c) => `${c} \u2014 acceptance: feature is reachable from the main nav, has loading + empty + error states, and is covered by at least one Playwright test.`)
        )
      },
      {
        heading: "UI / UX Design Principles",
        content: bullets([
          "Visual style: modern, minimal, dark-mode-first; rounded-2xl cards; generous whitespace",
          "Layout system: Tailwind + shadcn/ui primitives; responsive grid; mobile breakpoint as second-class but functional",
          "Accessibility: WCAG 2.1 AA, semantic HTML, full keyboard navigation, focus rings, prefers-reduced-motion respected",
          "Color: neutral slate base + a single accent (electric blue or violet); semantic tones for success / warn / danger only",
          "Typography: Inter for UI, JetBrains Mono for code; 14/16/20/28px scale",
          "Motion: subtle fades and 150-200ms transitions; no decorative animation",
          "States: every async surface has explicit loading, empty, and error renderings",
          "Microcopy: action-oriented, second-person, no AI hype"
        ])
      },
      {
        heading: "Vibe Coding Approach",
        content:
          "Use Copilot Chat to scaffold and refactor at the file/feature level; use inline completions for tight loops; use the GitHub Copilot CLI (`gh copilot suggest` / `explain`) for shell + IaC commands. Keep this Application Spec open in a side tab so Copilot picks it up as workspace context.\n\nGolden-path starter prompts to paste into Copilot Chat:\n\n```\n1. \"Scaffold a Next.js 14 + TypeScript + Tailwind app called 'doc-intel-prototype' using the App Router, pnpm, and shadcn/ui. Add ESLint, Prettier, Vitest, and Playwright.\"\n2. \"Create a Prisma schema for the Document, ExtractionResult, AdjudicationCase, and KpiSnapshot models from the Application Spec, targeting Postgres, with an SQLite fallback for local dev.\"\n3. \"Generate the API route handlers listed under 'API Surface' with Zod validation and a thin service layer that I can swap between a mock and real Azure AI client.\"\n4. \"Build the Adjudication Queue page: list low-confidence cases, show the document preview, and capture the operator decision with optimistic UI.\"\n5. \"Wire OpenTelemetry tracing into the API routes and export to Azure Application Insights.\"\n6. \"Write Playwright tests for the upload \u2192 classify \u2192 extract \u2192 adjudicate happy path.\"\n7. \"Generate a Bicep template that deploys this app to Azure Container Apps with managed identity access to Azure OpenAI and Document Intelligence.\"\n```"
      },
      {
        heading: "Phased Build Plan",
        content: bullets([
          "Phase 1 \u2014 Scaffold & shell: Next.js + Tailwind + shadcn/ui app with nav, theme, and empty pages. Exit: app runs locally, lints clean. Copilot prompt: \"Scaffold the app shell\u2026\".",
          "Phase 2 \u2014 Core flows with mocks: data model, API routes, list and detail screens against an in-memory mock service. Exit: end-to-end happy path works with seeded data. Copilot prompt: \"Implement the adjudication queue against the mock service\u2026\".",
          "Phase 3 \u2014 AI integration: replace mocks with Azure OpenAI + Document Intelligence calls behind a service interface. Exit: real extraction runs on at least one sample doc type.",
          "Phase 4 \u2014 Polish & deploy: a11y pass, telemetry, Playwright tests, Bicep, Container Apps deploy. Exit: stakeholder demo build."
        ])
      },
      {
        heading: "Quality, Testing, and Observability",
        content: bullets([
          "Unit + component tests: Vitest + React Testing Library",
          "E2E: Playwright; one happy-path spec per core feature",
          "Tracing: OpenTelemetry SDK \u2192 Azure Application Insights",
          "Logging: structured JSON via pino; correlation id per request",
          "Error handling: typed error envelopes from API routes; toast + inline rendering on the client",
          "Feature flags: env-driven flags object exposed via a `useFlags()` hook"
        ])
      },
      {
        heading: "Local Development & Deployment",
        content:
          "Prerequisites: Node 20, pnpm 9, Docker Desktop, Azure CLI, an Azure subscription with access to Azure OpenAI.\n\n```bash\npnpm install\ncp .env.example .env.local   # fill in AZURE_OPENAI_*, DATABASE_URL\npnpm prisma migrate dev\npnpm seed\npnpm dev\n```\n\nDeployment target: Azure Container Apps via Bicep + `az containerapp up`. Use a managed identity to grant the app `Cognitive Services User` on the Azure AI resources."
      },
      {
        heading: "Repo Structure",
        content:
          "```\ndoc-intel-prototype/\n  src/\n    app/                  # Next.js routes\n    components/           # shadcn/ui-based components\n    lib/\n      ai/                 # Azure AI client wrappers\n      db.ts               # Prisma client\n      telemetry.ts        # OTEL setup\n  prisma/\n    schema.prisma\n    seed.ts\n  tests/\n    e2e/                  # Playwright\n  infra/\n    main.bicep\n  .env.example\n  package.json\n```"
      },
      {
        heading: "Risks, Constraints, and Out-of-Scope",
        content: bullets([
          "Out of scope: production-grade auth, multi-tenant isolation, full RBAC, GDPR data residency",
          "AI grounding: prototype uses sample documents; real customer data requires Purview lineage and Content Safety policies",
          "Cost: Azure OpenAI calls metered; cap with rate limits in dev",
          "Security: do not commit secrets; use Key Vault references in deployed environments"
        ])
      },
      {
        heading: "Definition of Done",
        content: bullets([
          "Happy path runs end-to-end on a laptop with `pnpm dev`",
          "All core features have loading / empty / error states",
          "Playwright suite green",
          "App deploys to Azure Container Apps from `main`",
          "Telemetry visible in Application Insights",
          "README documents bootstrap, architecture, and demo script"
        ])
      }
    ],
    assumptions: [
      ...assumptions,
      "Solution Map artifact has been generated and reviewed; this spec inherits its architecture decisions.",
      "Developer running this spec has access to an Azure subscription with Azure OpenAI enabled."
    ],
    nextSteps: [
      "Open VS Code in an empty folder and paste the Application Spec into the workspace",
      "Run the Phase 1 starter prompt in Copilot Chat",
      "Iterate phase-by-phase, committing at each exit criterion"
    ]
  };
}

// ----- Public entrypoint -----

export async function runInnovationWorkflow(
  project: Project,
  inputs: Input[],
  options: { artifactTypes?: ArtifactType[]; customInstructions?: string } = {}
): Promise<OrchestrationResult> {
  const useLive = isLiveAIConfigured();
  const agents: AgentResult[] = [];
  const customInstructions = options.customInstructions;

  // Map agent names to their fallback implementations so we can iterate the
  // synthesis agents declaratively. Each entry is invoked when the live LLM
  // call fails or no provider is configured.
  const synthesisFallbacks: Record<string, () => unknown> = {
    "Intake Clarification Agent": () => fallbackIntake(project, inputs),
    "Pain Point Synthesis Agent": () => fallbackPainPoints(inputs),
    "Business Impact Agent": () => fallbackBusinessImpact(project),
    "Solution Concept Agent": () => fallbackSolutionConcept(),
    "Architecture and Solution Map Agent": () => fallbackArchitecture(),
    "KPI and Value Agent": () => fallbackKpis(),
    "Roadmap Agent": () => fallbackRoadmap(),
    "Executive Storytelling Agent": () => fallbackExecStory(project)
  };

  const baseContext = contextString(project, inputs);

  // Track each synthesis agent's output by display name so downstream agents
  // can read labeled handoff payloads via `upstream.<camelCaseName>` keys.
  const upstreamOutputs = new Map<string, unknown>();

  // Run each synthesis agent against the live LLM with its dedicated system
  // prompt. customInstructions is injected into every agent's user prompt.
  // Each agent receives only the upstream slices declared in its dependsOn.
  for (const def of SYNTHESIS_AGENTS) {
    const fb = synthesisFallbacks[def.name];
    const { handoff, missing } = buildUpstreamHandoff(def, upstreamOutputs);
    if (missing.length > 0) {
      console.warn(`[orchestrator] "${def.name}" missing upstream: ${missing.join(", ")} — proceeding with null payloads`);
    }
    const result = await executeAgent(def, baseContext, fb, { useLive, customInstructions, upstream: handoff });
    agents.push(result);
    upstreamOutputs.set(def.name, result.output);
  }

  const findOutput = (name: string) => agents.find((a) => a.name === name)?.output;
  const synthesis: SynthesisBundle = {
    intake: findOutput("Intake Clarification Agent"),
    painPoints: findOutput("Pain Point Synthesis Agent"),
    businessImpact: findOutput("Business Impact Agent"),
    solutionConcept: findOutput("Solution Concept Agent"),
    architecture: findOutput("Architecture and Solution Map Agent"),
    kpis: findOutput("KPI and Value Agent"),
    roadmap: findOutput("Roadmap Agent"),
    executiveStory: findOutput("Executive Storytelling Agent")
  };

  // ----- Artifact Packager Agent -----
  // For each requested artifact, ask the LLM to assemble the full
  // ArtifactContent given the synthesis bundle. Fall back to deterministic
  // assembly if the LLM call fails. The result of the packager agent in the
  // UI is the list of artifact types it produced.
  const requested = options.artifactTypes && options.artifactTypes.length
    ? options.artifactTypes
    : (safeJson<ArtifactType[]>(project.selectedArtifacts) ?? ["Impact Statement", "Executive Briefing Deck", "Solution Map", "90-Day Execution Plan"]);

  // The Application Spec depends on the Solution Map. If a user requested the
  // Application Spec without the Solution Map, auto-include the Solution Map so
  // its content is available as prerequisite context for the spec agent.
  // Also: split the request list so the packager only handles the standard
  // artifact types; the Application Spec is produced by its own dedicated agent
  // below, after the packager finishes.
  const requestedSet = new Set<ArtifactType>(requested);
  const wantsApplicationSpec = requestedSet.has("Application Spec");
  if (wantsApplicationSpec) {
    const prereqs = ARTIFACT_PREREQUISITES["Application Spec"] ?? [];
    for (const p of prereqs) requestedSet.add(p);
  }
  const packagerRequested: ArtifactType[] = Array.from(requestedSet).filter((t) => t !== "Application Spec");

  const packagerResult: Array<{ artifactType: ArtifactType; content: ArtifactContent; markdown: string }> = [];
  const packagerContext = JSON.stringify(
    {
      project: {
        name: project.name,
        client: project.clientName,
        industry: project.industry,
        businessProblem: project.businessProblem,
        desiredOutcomes: safeJson<string[]>(project.desiredOutcomes),
        targetAudience: safeJson<string[]>(project.targetAudience),
        timeHorizon: project.timeHorizon
      },
      inputs: inputs.map((i) => ({ category: i.category, persona: i.persona, priority: i.priority, content: i.content, votes: i.votes })),
      synthesis
    },
    null,
    2
  );

  const packager = await runAgent(ARTIFACT_PACKAGER_AGENT.name, async () => {
    const packagerHandoff = buildUpstreamHandoff(ARTIFACT_PACKAGER_AGENT, upstreamOutputs).handoff;
    // Parallelize per-artifact LLM calls. Each call is independent and uses the same
    // upstream synthesis context. Order is preserved via Promise.all index alignment.
    const perArtifact = await Promise.all(
      packagerRequested.map(async (t) => {
        let content: ArtifactContent | null = null;
        let llmFail = false;
        let llmErr: string | undefined;
        if (useLive) {
          try {
            const extra = `Artifact to produce now: ${t}\n\nFollow the section guidance for this artifact type from your system instructions.`;
            const system = composeSystemPrompt(ARTIFACT_PACKAGER_AGENT);
            const user = composeUserPrompt(ARTIFACT_PACKAGER_AGENT, packagerContext, customInstructions, extra, packagerHandoff);
            const llmContent = await getAIProvider().generateStructuredJson<ArtifactContent>(user, system);
            if (llmContent && llmContent.title && Array.isArray(llmContent.sections) && llmContent.sections.length > 0) {
              content = llmContent;
            } else {
              llmFail = true;
              llmErr = "LLM returned malformed artifact (missing title/sections)";
              console.warn(`[orchestrator] Packager LLM produced malformed artifact for "${t}"`);
            }
          } catch (err) {
            llmFail = true;
            llmErr = (err as Error).message;
            console.warn(`[orchestrator] Packager LLM failed for "${t}": ${llmErr}`);
          }
        }
        if (!content) content = buildArtifact(t, project, inputs, synthesis) as ArtifactContent;
        return { t, content, llmCalled: !llmFail && useLive, llmFail, llmErr };
      })
    );
    let llmCalls = 0;
    let llmFails = 0;
    let lastError: string | undefined;
    for (const r of perArtifact) {
      if (r.llmCalled) llmCalls++;
      if (r.llmFail) {
        llmFails++;
        lastError = r.llmErr;
      }
      packagerResult.push({ artifactType: r.t, content: r.content, markdown: renderMarkdown(r.content) });
    }
    return {
      __agent: true as const,
      output: packagerResult.map((a) => a.artifactType),
      usedLLM: llmCalls > 0,
      llmError: llmFails > 0 ? `${llmFails}/${packagerRequested.length} artifacts fell back to deterministic content. Last error: ${lastError}` : undefined
    };
  });
  agents.push(packager);
  upstreamOutputs.set(ARTIFACT_PACKAGER_AGENT.name, {
    artifacts: packagerResult.map((p) => ({ artifactType: p.artifactType, content: p.content }))
  });

  // ----- Application Spec Agent -----
  // Runs only if the user requested the Application Spec artifact. The Solution
  // Map artifact (auto-included above as a prerequisite) is passed as additional
  // context so the spec stays consistent with the agreed reference architecture.
  if (wantsApplicationSpec) {
    const solutionMap = packagerResult.find((p) => p.artifactType === "Solution Map");
    const specContext = JSON.stringify(
      {
        project: {
          name: project.name,
          client: project.clientName,
          industry: project.industry,
          businessProblem: project.businessProblem,
          desiredOutcomes: safeJson<string[]>(project.desiredOutcomes),
          targetAudience: safeJson<string[]>(project.targetAudience),
          timeHorizon: project.timeHorizon
        },
        synthesis,
        solutionMap: solutionMap ? { content: solutionMap.content, markdown: solutionMap.markdown } : null
      },
      null,
      2
    );
    const specOutcomes = safeJson<string[]>(project.desiredOutcomes) ?? [];
    void specOutcomes;
    const specAssumptions: string[] = [
      ...((synthesis.intake?.assumptions as string[]) ?? []),
      "Directional metrics will be validated against baseline data captured in the first 30 days."
    ];
    const specFallback = () => buildApplicationSpecFallback(project, synthesis, specAssumptions);

    const specAgent = await runAgent(APPLICATION_SPEC_AGENT.name, async () => {
      const specHandoff = buildUpstreamHandoff(APPLICATION_SPEC_AGENT, upstreamOutputs).handoff;
      let content: ArtifactContent | null = null;
      let usedLLM = false;
      let llmError: string | undefined;
      if (useLive) {
        try {
          const extra =
            "Artifact to produce now: Application Spec.\n\n" +
            "The Solution Map artifact has been generated and is included in your context as `solutionMap`. Treat it as the prerequisite source of truth and do not contradict its architecture, components, or data flow.\n\n" +
            "Follow the section guidance from your system instructions exactly.";
          const system = composeSystemPrompt(APPLICATION_SPEC_AGENT);
          const user = composeUserPrompt(APPLICATION_SPEC_AGENT, specContext, customInstructions, extra, specHandoff);
          const llmContent = await getAIProvider().generateStructuredJson<ArtifactContent>(user, system);
          if (llmContent && llmContent.title && Array.isArray(llmContent.sections) && llmContent.sections.length > 0) {
            content = llmContent;
            usedLLM = true;
          } else {
            llmError = "LLM returned malformed Application Spec (missing title/sections)";
            console.warn(`[orchestrator] Application Spec LLM produced malformed artifact`);
          }
        } catch (err) {
          llmError = (err as Error).message;
          console.warn(`[orchestrator] Application Spec LLM failed: ${llmError}`);
        }
      }
      if (!content) content = specFallback();
      packagerResult.push({ artifactType: "Application Spec", content, markdown: renderMarkdown(content) });
      return { __agent: true as const, output: { artifactType: "Application Spec" }, usedLLM, llmError };
    });
    agents.push(specAgent);
    upstreamOutputs.set(APPLICATION_SPEC_AGENT.name, { artifactType: "Application Spec" });
  }

  // ----- Review and Quality Agent -----
  const reviewContext = JSON.stringify(
    {
      project: { name: project.name, businessProblem: project.businessProblem },
      synthesis,
      artifacts: packagerResult.map((p) => ({ artifactType: p.artifactType, content: p.content }))
    },
    null,
    2
  );
  const reviewFallback = () => {
    const missing: string[] = [];
    const suggestions: string[] = [];
    const perArtifactScores: Array<{ artifactType: string; score: number; gaps: string[] }> = [];
    for (const a of packagerResult) {
      const gaps: string[] = [];
      if (!a.content.sections.length) {
        missing.push(`${a.artifactType}: no sections`);
        gaps.push("No sections rendered");
      }
      if (!a.content.nextSteps?.length) {
        suggestions.push(`${a.artifactType}: add next steps`);
        gaps.push("Missing next steps");
      }
      if (!a.content.assumptions?.length) {
        gaps.push("Missing assumptions");
      }
      const score = Math.max(60, 100 - gaps.length * 10);
      perArtifactScores.push({ artifactType: a.artifactType, score, gaps });
    }
    return {
      qualityScore: Math.max(60, 100 - missing.length * 10 - suggestions.length * 5),
      missingSections: missing,
      suggestedEdits: suggestions,
      consistencyFindings: [] as string[],
      perArtifactScores
    };
  };
  const reviewHandoff = buildUpstreamHandoff(REVIEW_AGENT, upstreamOutputs).handoff;
  const review = await executeAgent(REVIEW_AGENT, reviewContext, reviewFallback, { useLive, customInstructions, upstream: reviewHandoff });
  agents.push(review);

  return {
    agents,
    synthesis,
    artifacts: packagerResult,
    review: review.output as OrchestrationResult["review"],
    usedLiveAI: useLive
  };
}

export async function regenerateArtifact(
  project: Project,
  inputs: Input[],
  existingMarkdown: string,
  artifactType: ArtifactType,
  revisionInstructions: string
): Promise<{ content: ArtifactContent; markdown: string }> {
  // Re-run synthesis (cheap deterministic) and rebuild with custom emphasis appended to next steps
  const r = await runInnovationWorkflow(project, inputs, { artifactTypes: [artifactType], customInstructions: revisionInstructions });
  const found = r.artifacts.find((a) => a.artifactType === artifactType);
  if (!found) throw new Error("Failed to regenerate artifact");
  if (revisionInstructions) {
    found.content.assumptions = [...(found.content.assumptions ?? []), `Revision guidance applied: ${revisionInstructions}`];
    found.markdown = renderMarkdown(found.content);
  }
  return { content: found.content, markdown: found.markdown };
}

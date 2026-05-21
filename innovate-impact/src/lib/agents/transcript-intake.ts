/**
 * Transcript Intake Agent.
 *
 * Given a meeting/workshop transcript (or raw notes) and a project context,
 * produce a list of candidate Workshop Board input cards. Two paths:
 *
 *   1. Live AI path — uses the shared `getAIProvider()` to call Foundry /
 *      Azure OpenAI / OpenAI with a strict JSON schema.
 *   2. Demo fallback — deterministic keyword heuristic so the feature works
 *      when no AI provider is configured (or when the live call throws).
 *
 * The agent NEVER persists anything. The route that calls it returns the
 * candidates to the UI for a human-in-the-loop review before they're
 * committed via the batch-insert endpoint.
 */

import { getAIProvider, isLiveAIConfigured } from "@/lib/ai/provider";
import {
  CATEGORIES,
  PERSONAS,
  PRIORITIES,
  type Category,
  type Persona,
  type Priority,
  isCategory,
  isPersona,
  isPriority,
} from "@/lib/workshop-enums";

export const HARD_CAP = 50;
export const DEMO_CAP = 30;

export type WorkshopInputDraft = {
  category: Category;
  persona: Persona | null;
  priority: Priority;
  content: string;
  evidence: string;
  confidence: number;
  source: "ai" | "demo";
};

export type ProjectContext = {
  name: string;
  industry?: string | null;
  businessProblem?: string | null;
  desiredOutcomes?: string[];
};

export type TranscriptIntakeResult = {
  cards: WorkshopInputDraft[];
  usedLLM: boolean;
  llmError?: string;
  inputCharLength: number;
  durationMs: number;
};

const SYSTEM_PROMPT = `You are the Transcript Intake Agent for Workshop Buddy.

Input is a single text blob: a meeting transcript, Teams captions, or raw notes from a customer discovery conversation. Your job is to extract a list of discrete Workshop Board input cards.

Rules:
- Each card represents ONE atomic idea (one pain point, one outcome, one constraint, one quote, etc.). Do not bundle multiple ideas.
- 'category' MUST be exactly one of: ${CATEGORIES.join(" | ")}.
- 'persona' MUST be exactly one of: ${PERSONAS.join(" | ")}. Use null only if no persona is clearly implied.
- 'priority' MUST be exactly one of: ${PRIORITIES.join(" | ")}. Default to Medium when severity is unclear.
- 'content' is a crisp 1-2 sentence paraphrase suitable for a sticky note. Do NOT include speaker names or timestamps.
- 'evidence' is a verbatim quote (<= 240 chars) from the transcript that justifies this card. If no direct quote, use "" (empty string).
- 'confidence' is a number 0-1 reflecting how clearly the transcript supports this card.
- Aim for 10-40 cards depending on transcript length. Quality over quantity. Deduplicate near-identical ideas.
- Hard cap: never return more than ${HARD_CAP} cards in total.
- If the user provided facilitator hints, weight cards that align with those hints higher.

Return ONLY a JSON object of the shape: {"cards": [ ... ]}.`;

function buildUserPrompt(text: string, project: ProjectContext, hints?: string): string {
  const outcomes = (project.desiredOutcomes ?? []).slice(0, 8).map((o) => `- ${o}`).join("\n");
  return [
    "PROJECT CONTEXT",
    `Name: ${project.name}`,
    project.industry ? `Industry: ${project.industry}` : "",
    project.businessProblem ? `Business problem: ${project.businessProblem}` : "",
    outcomes ? `Desired outcomes:\n${outcomes}` : "",
    "",
    hints ? `FACILITATOR HINTS\n${hints}\n` : "",
    "TRANSCRIPT / NOTES",
    "```",
    text,
    "```",
    "",
    `Return JSON: {"cards": [{"category", "persona"|null, "priority", "content", "evidence", "confidence"}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitize(raw: unknown): WorkshopInputDraft[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { cards?: unknown }).cards;
  if (!Array.isArray(arr)) return [];

  const out: WorkshopInputDraft[] = [];
  const seen = new Set<string>();

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (!content) continue;
    if (!isCategory(o.category)) continue;
    const persona = o.persona == null ? null : isPersona(o.persona) ? o.persona : null;
    const priority: Priority = isPriority(o.priority) ? o.priority : "Medium";
    const evidence = typeof o.evidence === "string" ? o.evidence.slice(0, 280) : "";
    const confRaw = typeof o.confidence === "number" ? o.confidence : 0.6;
    const confidence = Math.max(0, Math.min(1, confRaw));

    const key = `${o.category}::${content.toLowerCase().slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      category: o.category,
      persona,
      priority,
      content,
      evidence,
      confidence,
      source: "ai",
    });

    if (out.length >= HARD_CAP) break;
  }

  // Sort by confidence desc so the review table leads with strongest cards.
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

// ---------------------------------------------------------------------------
// Demo / fallback extractor — deterministic keyword heuristics.
// ---------------------------------------------------------------------------

const SPEAKER_RE = /^\s*(?:\[[^\]]+\]\s*)?[A-Z][A-Za-z .'-]{1,40}(?:\s*\([^)]+\))?\s*:\s*/;
const TIMESTAMP_RE = /\[\d{1,2}:\d{2}(?::\d{2})?\]/g;
const PERSONA_KEYWORDS: Array<[Persona, RegExp]> = [
  ["Finance", /\b(cfo|finance|budget|cost|spend|invoice|roi|fte|cents on the dollar)\b/i],
  ["Compliance", /\b(cco|compliance|regulator|gdpr|hipaa|audit|sanction|customs|policy)\b/i],
  ["IT", /\b(cio|it manager|infrastructure|legacy|ad\b|active directory|on-prem|tms|oracle|snowflake)\b/i],
  ["Engineering", /\b(engineer|developer|architect|sdk|api|aks|python|fine-tun|model|rag)\b/i],
  ["Customer Experience", /\b(customer|nps|sla|cx|self-service|satisfaction|account manager)\b/i],
  ["Sales", /\b(sales|account exec|pipeline|quota|prospect)\b/i],
  ["Marketing", /\b(marketing|campaign|brand|content|seo)\b/i],
  ["Executive", /\b(ceo|coo|exec|leadership|board|steering committee|sponsor)\b/i],
  ["Operations", /\b(operations?|operator|ops|process|workflow|backlog|exception|queue)\b/i],
];

type CatRule = { category: Category; persona: Persona | null; re: RegExp; priorityBoost?: Priority };
const CATEGORY_RULES: CatRule[] = [
  { category: "Cost of Inaction", persona: "Finance", re: /\b(cost of inaction|leave .* on the table|by 20\d\d this is|line item|burn|every quarter we delay)\b/i, priorityBoost: "Critical" },
  { category: "KPI / Metric", persona: null, re: /\b(\d+(\.\d+)?%|kpi|sla|cycle time|throughput|straight[- ]through|stp|nps|cost per|per document|refresh(ed)? (at least )?hourly|dashboard)\b/i },
  { category: "Risk / Dependency", persona: "Compliance", re: /\b(compliance|regulator|gdpr|hipaa|audit|sanction|customs|risk|lock[- ]in|hallucinat|vendor)\b/i, priorityBoost: "High" },
  { category: "Technical Constraint", persona: "IT", re: /\b(legacy|on-prem|sdk|api|integration|tms|oracle|snowflake|black box|cannot|can't|won't fit|incompatible|tenant boundary|private endpoint)\b/i },
  { category: "Process Bottleneck", persona: "Operations", re: /\b(weeks?|months?|onboarding|exception queue|backlog|manual|rekey|retype|template)\b/i },
  { category: "Customer Impact", persona: "Customer Experience", re: /\b(customer|nps|sla|self-service|satisfaction|complaint|sla breach|hours? to answer|response time)\b/i },
  { category: "Operational Impact", persona: "Operations", re: /\b(operator|capacity|headcount|turnover|attrition|peak season|cutover)\b/i },
  { category: "Solution Idea", persona: null, re: /\b(we could|what if|recommend|propose|pilot|prototype|next best action|copilot|agent|rag|surface a)\b/i },
  { category: "Business Outcome", persona: "Executive", re: /\b(we want|our goal|target|objective|measurable|recoup|by (q\d|next year|end of)|board[- ]ready|success looks like)\b/i },
  { category: "Pain Point", persona: "Operations", re: /\b(broken|slow|painful|frustrat|fall(s)? over|breaks?|soul[- ]destroying|unsustainable|hurts?|nightmare)\b/i },
];

const PRIORITY_BY_WORD: Array<[Priority, RegExp]> = [
  ["Critical", /\b(critical|blocker|non[- ]negotiable|must|cannot|hard constraint|deal[- ]breaker)\b/i],
  ["High", /\b(important|major|urgent|priority|asap|by (q3|q4|november|december))\b/i],
  ["Low", /\b(nice to have|stretch|someday|low priority)\b/i],
];

function inferPersona(sentence: string): Persona | null {
  for (const [persona, re] of PERSONA_KEYWORDS) {
    if (re.test(sentence)) return persona;
  }
  return null;
}

function inferPriority(sentence: string): Priority {
  for (const [p, re] of PRIORITY_BY_WORD) {
    if (re.test(sentence)) return p;
  }
  return "Medium";
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"\(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 600);
}

export function stripTranscriptFurniture(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP_RE, "").replace(SPEAKER_RE, "").trim())
    .filter((line) => line.length > 0 && !/^-+$/.test(line))
    .join("\n");
}

export function demoExtract(text: string): WorkshopInputDraft[] {
  const cleaned = stripTranscriptFurniture(text);
  const sentences = splitSentences(cleaned);
  const cards: WorkshopInputDraft[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    let chosen: CatRule | null = null;
    for (const rule of CATEGORY_RULES) {
      if (rule.re.test(sentence)) {
        chosen = rule;
        break;
      }
    }
    if (!chosen) continue;

    const persona = inferPersona(sentence) ?? chosen.persona;
    const priority = chosen.priorityBoost ?? inferPriority(sentence);
    const trimmed = sentence.length > 220 ? sentence.slice(0, 217) + "…" : sentence;
    const evidence = sentence.length > 240 ? sentence.slice(0, 237) + "…" : sentence;

    const key = `${chosen.category}::${trimmed.toLowerCase().slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push({
      category: chosen.category,
      persona,
      priority,
      content: trimmed,
      evidence,
      confidence: 0.4,
      source: "demo",
    });

    if (cards.length >= DEMO_CAP) break;
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runTranscriptIntakeAgent(
  text: string,
  project: ProjectContext,
  hints?: string,
): Promise<TranscriptIntakeResult> {
  const started = Date.now();
  const inputCharLength = text.length;

  if (!text.trim()) {
    return { cards: [], usedLLM: false, inputCharLength, durationMs: Date.now() - started };
  }

  if (isLiveAIConfigured()) {
    try {
      const provider = getAIProvider();
      const raw = await provider.generateStructuredJson<unknown>(
        buildUserPrompt(text, project, hints),
        SYSTEM_PROMPT,
      );
      const cards = sanitize(raw);
      if (cards.length > 0) {
        return { cards, usedLLM: true, inputCharLength, durationMs: Date.now() - started };
      }
      // Live call returned zero usable cards — fall through to demo extractor.
      const demo = demoExtract(text);
      return {
        cards: demo,
        usedLLM: false,
        llmError: "Live AI returned no usable cards; demo extractor used.",
        inputCharLength,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      const demo = demoExtract(text);
      return {
        cards: demo,
        usedLLM: false,
        llmError: err instanceof Error ? err.message : String(err),
        inputCharLength,
        durationMs: Date.now() - started,
      };
    }
  }

  const demo = demoExtract(text);
  return { cards: demo, usedLLM: false, inputCharLength, durationMs: Date.now() - started };
}

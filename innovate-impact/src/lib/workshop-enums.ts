/**
 * Shared Workshop Board enums. Imported by the UI (workshop-board.tsx,
 * transcript-import-modal.tsx) and the server-side Transcript Intake Agent so
 * there is one source of truth for the values a `WorkshopInput` row can hold.
 */

export const CATEGORIES = [
  "Pain Point",
  "Business Outcome",
  "Process Bottleneck",
  "Customer Impact",
  "Operational Impact",
  "Technical Constraint",
  "Solution Idea",
  "KPI / Metric",
  "Risk / Dependency",
  "Cost of Inaction",
] as const;

export const PERSONAS = [
  "Operations",
  "IT",
  "Finance",
  "Compliance",
  "Customer Experience",
  "Sales",
  "Marketing",
  "Engineering",
  "Executive",
] as const;

export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Persona = (typeof PERSONAS)[number];
export type Priority = (typeof PRIORITIES)[number];

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
export function isPersona(v: unknown): v is Persona {
  return typeof v === "string" && (PERSONAS as readonly string[]).includes(v);
}
export function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}

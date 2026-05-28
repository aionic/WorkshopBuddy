export interface ArtifactSection {
  heading: string;
  content: string;
}

export interface ArtifactContent {
  title: string;
  subtitle?: string;
  sections: ArtifactSection[];
  assumptions?: string[];
  nextSteps?: string[];
  /** Optional executive metrics for headline banners (Impact Statement / PPTX) */
  metrics?: Array<{ label: string; value: string; subtext?: string }>;
}

export const ARTIFACT_TYPES = [
  "Impact Statement",
  "Executive Briefing Deck",
  "Solution Map",
  "90-Day Execution Plan",
  "Trends White Paper",
  "KPI Framework",
  "Application Spec"
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/**
 * Artifacts that depend on another artifact's content. The dependent artifact
 * must be generated (or auto-included) before this one can be packaged.
 */
export const ARTIFACT_PREREQUISITES: Partial<Record<ArtifactType, ArtifactType[]>> = {
  "Application Spec": ["Solution Map"]
};

export function artifactFormats(type: string): Array<"markdown" | "docx" | "pptx"> {
  if (type === "Executive Briefing Deck") return ["markdown", "pptx"];
  return ["markdown", "docx"];
}

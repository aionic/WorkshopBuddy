/**
 * S-10 / P0-5: Zod request-body schemas.
 *
 * One file = single source of truth for every API write contract. Each
 * route imports its schema and calls `parseBody(req, schema)` which
 * returns either parsed data or an apiError NextResponse.
 */
import { z } from "zod";
import { CATEGORIES, PERSONAS, PRIORITIES } from "@/lib/workshop-enums";
import { ARTIFACT_TYPES } from "@/lib/artifacts/artifact-schemas";

// ---------- Project ----------

const projectStatus = z.enum(["Active", "Archived"]);
const trimmedString = (max: number) => z.string().trim().min(1).max(max);

export const projectCreateSchema = z.object({
  name: trimmedString(200),
  businessProblem: trimmedString(4000),
  clientName: z.string().trim().max(200).nullish(),
  tpid: z.string().trim().max(50).nullish(),
  msxOppId: z.string().trim().max(50).nullish(),
  industry: z.string().trim().max(100).nullish(),
  desiredOutcomes: z.array(z.string().max(500)).max(20).optional(),
  targetAudience: z.array(z.string().max(200)).max(20).optional(),
  selectedArtifacts: z.array(z.enum(ARTIFACT_TYPES)).max(20).optional(),
  timeHorizon: z.string().trim().max(100).nullish(),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  status: projectStatus.optional(),
});
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

// ---------- WorkshopInput ----------

export const inputCreateSchema = z.object({
  category: z.enum(CATEGORIES),
  persona: z.enum(PERSONAS).nullish(),
  priority: z.enum(PRIORITIES).default("Medium"),
  content: trimmedString(2000),
  submittedBy: z.string().trim().max(200).nullish(),
});
export type InputCreate = z.infer<typeof inputCreateSchema>;

export const inputUpdateSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  persona: z.enum(PERSONAS).nullish(),
  priority: z.enum(PRIORITIES).optional(),
  content: trimmedString(2000).optional(),
  submittedBy: z.string().trim().max(200).nullish(),
});
export type InputUpdate = z.infer<typeof inputUpdateSchema>;

export const inputBatchSchema = z.object({
  items: z.array(inputCreateSchema).min(1).max(100),
  transcriptIngestId: z.string().min(1).optional(),
});
export type InputBatch = z.infer<typeof inputBatchSchema>;

/**
 * Envelope schema for /inputs/batch. We validate the OUTER shape strictly
 * with zod (so malformed bodies return 400 early), but keep `items` as
 * unknown[] so the route can `safeParse` each item individually and
 * report partial errors instead of rejecting the whole batch.
 */
export const inputBatchEnvelopeSchema = z.object({
  items: z.array(z.unknown()).min(1).max(100),
  transcriptIngestId: z.string().min(1).optional(),
});
export type InputBatchEnvelope = z.infer<typeof inputBatchEnvelopeSchema>;

// ---------- AgentRun ----------

export const agentRunCreateSchema = z.object({
  mode: z.string().max(50).optional(),
  artifactTypes: z.array(z.enum(ARTIFACT_TYPES)).max(20).optional(),
  customInstructions: z.string().max(4000).optional(),
});
export type AgentRunCreate = z.infer<typeof agentRunCreateSchema>;

// ---------- Artifact ----------

export const artifactStatus = z.enum(["Draft", "InReview", "Approved", "Final"]);

export const artifactUpdateSchema = z.object({
  title: trimmedString(300).optional(),
  status: artifactStatus.optional(),
  markdown: z.string().max(200_000).optional(),
  // contentJson is a structured object; we pass through unknown and let
  // downstream code own its shape (renderers validate as needed).
  contentJson: z.unknown().optional(),
});
export type ArtifactUpdate = z.infer<typeof artifactUpdateSchema>;

export const artifactRegenerateSchema = z.object({
  revisionInstructions: z.string().max(4000).optional(),
});
export type ArtifactRegenerate = z.infer<typeof artifactRegenerateSchema>;

// ---------- Transcript extract (JSON variant; multipart handled in-route) ----------

/**
 * Pasted transcript JSON branch. Cap at 1 MB of characters (≈ the
 * BACKLOG P0-5 acceptance criterion). Over-length pasted text is
 * surfaced to the user with a 413 in the route, not a generic 400.
 */
export const TRANSCRIPT_TEXT_MAX_CHARS = 1_048_576;

export const transcriptExtractJsonSchema = z.object({
  text: z.string().trim().min(1).max(TRANSCRIPT_TEXT_MAX_CHARS),
  hints: z.string().max(2000).optional(),
});
export type TranscriptExtractJson = z.infer<typeof transcriptExtractJsonSchema>;

/**
 * Multipart branch: only the `hints` text field needs zod; `file` and
 * `text` are pulled directly from FormData and length-checked by the
 * transcript parser (10 MB file cap) and TRANSCRIPT_TEXT_MAX_CHARS.
 */
export const transcriptExtractFormHintsSchema = z.string().max(2000);

// S-3 / S-5: shared Service Bus envelope contract + truncation helper.
// Producer (web) and consumer (worker) both validate against this schema so
// malformed messages fail loudly at the boundary instead of corrupting runs.
import { z } from "zod";

export const AGENT_RUN_ENVELOPE_VERSION = 1;

export const agentRunEnvelopeSchema = z.object({
  version: z.literal(AGENT_RUN_ENVELOPE_VERSION),
  runId: z.string().min(1),
  projectId: z.string().min(1),
});

export type AgentRunEnvelope = z.infer<typeof agentRunEnvelopeSchema>;

/** Cap free-form error / output strings written to AgentRun columns. */
export const AGENT_RUN_ERROR_MAX = 4096;

export function truncate(value: string, max = AGENT_RUN_ERROR_MAX): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 16)) + "…(truncated)";
}

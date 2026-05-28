/**
 * S-7: Typed environment configuration.
 *
 * Single source of truth for `process.env` reads. Validated lazily on
 * first field access (not at module import) because `next build`'s
 * page-data collector and Next.js client bundling both load this file
 * in contexts where deployment env vars are not present — failing at
 * import time would break the build.
 *
 * Use `validateEnv()` from `start.js` / health probes to fail fast at
 * boot when something required is missing.
 *
 * Provider-specific keys are only required when the corresponding
 * `AI_PROVIDER` is selected:
 *   - AI_PROVIDER=azure_foundry  → AZURE_FOUNDRY_RESPONSES_ENDPOINT + AZURE_FOUNDRY_MODEL
 *   - AI_PROVIDER=azure_openai   → AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY + AZURE_OPENAI_DEPLOYMENT
 *   - AI_PROVIDER=openai         → OPENAI_API_KEY
 *   - AI_PROVIDER=demo (default) → no AI vars required
 */
import { z } from "zod";

const credentialMode = z.enum(["cli", "default", "managed-identity"]);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Credential strategy — S-8. Explicit, no presence-based heuristics.
  // Defaults: `cli` locally, `managed-identity` in production.
  AZURE_CREDENTIAL_MODE: credentialMode.optional(),
  AZURE_CLIENT_ID: z.string().optional(),

  // AI provider selection
  AI_PROVIDER: z.enum(["azure_foundry", "azure_openai", "openai", "demo", ""]).default(""),

  // Provider-specific (presence checked conditionally below)
  AZURE_FOUNDRY_RESPONSES_ENDPOINT: z.string().url().optional(),
  AZURE_FOUNDRY_MODEL: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  // Service Bus (worker enqueue)
  SERVICEBUS_NAMESPACE: z.string().optional(),
  SERVICEBUS_QUEUE: z.string().optional(),

  // Local dev auth bypass (S-1 in P0-1)
  DEV_AUTH_BYPASS_OID: z.string().optional(),
  DEV_AUTH_BYPASS_UPN: z.string().optional(),
  DEV_AUTH_BYPASS_NAME: z.string().optional(),
});

export type Env = z.infer<typeof baseSchema>;

function readRaw(): Record<string, string | undefined> {
  // Snapshot at validation time so tests can mutate process.env then re-validate.
  return { ...process.env };
}

function resolveCredentialMode(parsed: Env): "cli" | "default" | "managed-identity" {
  if (parsed.AZURE_CREDENTIAL_MODE) return parsed.AZURE_CREDENTIAL_MODE;
  return parsed.NODE_ENV === "production" ? "managed-identity" : "cli";
}

function validate(): Env & { credentialMode: ReturnType<typeof resolveCredentialMode> } {
  const parsed = baseSchema.safeParse(readRaw());
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`[env] invalid: ${issues}`);
  }
  const value = parsed.data;

  // Provider-specific required-field checks.
  const provider = value.AI_PROVIDER || "demo";
  const missing: string[] = [];
  if (provider === "azure_foundry") {
    if (!value.AZURE_FOUNDRY_RESPONSES_ENDPOINT) missing.push("AZURE_FOUNDRY_RESPONSES_ENDPOINT");
    if (!value.AZURE_FOUNDRY_MODEL) missing.push("AZURE_FOUNDRY_MODEL");
  } else if (provider === "azure_openai") {
    if (!value.AZURE_OPENAI_ENDPOINT) missing.push("AZURE_OPENAI_ENDPOINT");
    if (!value.AZURE_OPENAI_API_KEY) missing.push("AZURE_OPENAI_API_KEY");
    if (!value.AZURE_OPENAI_DEPLOYMENT) missing.push("AZURE_OPENAI_DEPLOYMENT");
  } else if (provider === "openai") {
    if (!value.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  }

  // Credential-mode cross-checks.
  const credMode = resolveCredentialMode(value);
  if (credMode === "managed-identity" && !value.AZURE_CLIENT_ID) {
    missing.push("AZURE_CLIENT_ID (required when AZURE_CREDENTIAL_MODE=managed-identity)");
  }

  if (missing.length) {
    throw new Error(`[env] missing for AI_PROVIDER=${provider}: ${missing.join(", ")}`);
  }

  return { ...value, credentialMode: credMode };
}

let cached: ReturnType<typeof validate> | null = null;
function ensure(): ReturnType<typeof validate> {
  if (!cached) cached = validate();
  return cached;
}

/**
 * Force re-validation. Call from `start.js` boot gate, tests, or after
 * mutating `process.env` for hot-reload scenarios.
 */
export function validateEnv(): void {
  cached = null;
  ensure();
}

/**
 * Typed env proxy. Validation runs on first property access; subsequent
 * accesses are cached. Safe to import from any module — does NOT touch
 * `process.env` until something reads a field.
 */
export const env = new Proxy({} as ReturnType<typeof validate>, {
  get(_target, prop, receiver) {
    return Reflect.get(ensure(), prop, receiver);
  },
});

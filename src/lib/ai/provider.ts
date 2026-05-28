/**
 * AI provider abstraction. Supports Azure AI Foundry (Entra-only, Responses API),
 * Azure OpenAI (key-based), OpenAI-compatible endpoints, and a deterministic
 * mock provider used when nothing is configured so the seeded demo always works.
 */
import {
  AzureCliCredential,
  DefaultAzureCredential,
  type AccessToken,
  type TokenCredential,
} from "@azure/identity";

// Cached Entra credential + token for Azure AI Foundry. The Foundry
// Responses API at services.ai.azure.com expects audience
// https://ai.azure.com (NOT cognitiveservices.azure.com — that yields 401
// "audience is incorrect").
const FOUNDRY_SCOPE = "https://ai.azure.com/.default";
let cachedCredential: TokenCredential | null = null;
let cachedToken: AccessToken | null = null;

function getCredential(): TokenCredential {
  if (!cachedCredential) {
    // In ACA, AZURE_CLIENT_ID is the UAMI. Locally, force AzureCliCredential
    // so the token is minted for the UPN from `az login` (avoids the
    // DefaultAzureCredential chain picking VS Code / env / shared-cache).
    cachedCredential = process.env.AZURE_CLIENT_ID
      ? new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID })
      : new AzureCliCredential();
  }
  return cachedCredential;
}

async function getEntraToken(): Promise<string> {
  // Refresh if missing or within 60s of expiry
  if (cachedToken && cachedToken.expiresOnTimestamp - Date.now() > 60_000) {
    return cachedToken.token;
  }
  const tok = await getCredential().getToken(FOUNDRY_SCOPE);
  if (!tok) throw new Error("Failed to acquire Entra token for Azure AI Foundry");
  cachedToken = tok;
  return tok.token;
}

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  generateText(prompt: string, system?: string): Promise<string>;
  generateStructuredJson<T = unknown>(prompt: string, system?: string): Promise<T>;
}

class MockProvider implements AIProvider {
  name = "mock";
  isConfigured() {
    return true;
  }
  async generateText(prompt: string): Promise<string> {
    return `# Mock AI Response\n\nThis is deterministic demo content generated because no AI provider is configured.\n\nPrompt preview: ${prompt
      .slice(0, 200)
      .replace(/\n/g, " ")}...`;
  }
  async generateStructuredJson<T = unknown>(): Promise<T> {
    return {} as T;
  }
}

async function callOpenAICompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  jsonMode?: boolean;
  azureKeyHeader?: boolean;
}): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.azureKeyHeader) headers["api-key"] = opts.apiKey;
  else headers["Authorization"] = `Bearer ${opts.apiKey}`;

  const body: Record<string, unknown> = {
    messages: opts.messages,
    temperature: 0.4,
    max_tokens: 3500
  };
  if (!opts.azureKeyHeader) body.model = opts.model;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(opts.url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

class AzureOpenAIProvider implements AIProvider {
  name = "azure_openai";
  isConfigured() {
    return Boolean(
      process.env.AZURE_OPENAI_ENDPOINT &&
        process.env.AZURE_OPENAI_API_KEY &&
        process.env.AZURE_OPENAI_DEPLOYMENT
    );
  }
  private url() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
    return `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  }
  async generateText(prompt: string, system?: string) {
    return callOpenAICompatible({
      url: this.url(),
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt }
      ],
      azureKeyHeader: true
    });
  }
  async generateStructuredJson<T>(prompt: string, system?: string): Promise<T> {
    const raw = await callOpenAICompatible({
      url: this.url(),
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt + "\n\nReturn ONLY valid JSON." }
      ],
      jsonMode: true,
      azureKeyHeader: true
    });
    return parseJsonOrRepair<T>(raw);
  }
}

class OpenAIProvider implements AIProvider {
  name = "openai";
  isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  }
  async generateText(prompt: string, system?: string) {
    return callOpenAICompatible({
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt }
      ]
    });
  }
  async generateStructuredJson<T>(prompt: string, system?: string): Promise<T> {
    const raw = await callOpenAICompatible({
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt + "\n\nReturn ONLY valid JSON." }
      ],
      jsonMode: true
    });
    return parseJsonOrRepair<T>(raw);
  }
}

/**
 * Azure AI Foundry provider — uses the OpenAI Responses API at the project's
 * model endpoint, authenticated with Entra ID (DefaultAzureCredential). No API
 * keys. Requires the runtime identity to have role "Cognitive Services User"
 * (or "Azure AI User") on the Foundry / AI Services resource.
 */
class AzureFoundryProvider implements AIProvider {
  name = "azure_foundry";
  isConfigured() {
    return Boolean(process.env.AZURE_FOUNDRY_RESPONSES_ENDPOINT && process.env.AZURE_FOUNDRY_MODEL);
  }
  private async call(input: Array<{ role: string; content: string }>, jsonMode = false): Promise<string> {
    const token = await getEntraToken();
    const body: Record<string, unknown> = {
      model: process.env.AZURE_FOUNDRY_MODEL,
      // Responses API requires each input item to have type:"message" — bare
      // {role, content} returns 400 "Invalid value" for input[i].
      input: input.map((m) => ({ type: "message", role: m.role, content: m.content }))
    };
    if (jsonMode) body.text = { format: { type: "json_object" } };

    const res = await fetch(process.env.AZURE_FOUNDRY_RESPONSES_ENDPOINT!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure Foundry request failed (${res.status}): ${text.slice(0, 800)}`);
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (typeof data.output_text === "string" && data.output_text.length > 0) return data.output_text;
    if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const item of data.output) {
        for (const c of item.content ?? []) {
          if (typeof c.text === "string") parts.push(c.text);
        }
      }
      if (parts.length) return parts.join("\n");
    }
    if (data.choices?.[0]?.message?.content) return data.choices[0].message!.content!;
    return "";
  }
  async generateText(prompt: string, system?: string) {
    return this.call([
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt }
    ]);
  }
  async generateStructuredJson<T>(prompt: string, system?: string): Promise<T> {
    const raw = await this.call(
      [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt + "\n\nReturn ONLY valid JSON." }
      ],
      true
    );
    return parseJsonOrRepair<T>(raw);
  }
}

class _OpenAIProvider_unused {
  // Kept for backwards-compat reference — see OpenAIProvider above.
}

function parseJsonOrRepair<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to extract JSON object/array from text
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error("Model returned invalid JSON");
  }
}

let cachedProvider: AIProvider | null = null;
export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;
  const which = (process.env.AI_PROVIDER || "").toLowerCase();
  if (which === "azure_foundry") {
    const p = new AzureFoundryProvider();
    if (p.isConfigured()) return (cachedProvider = p);
  }
  if (which === "azure_openai") {
    const p = new AzureOpenAIProvider();
    if (p.isConfigured()) return (cachedProvider = p);
  }
  if (which === "openai") {
    const p = new OpenAIProvider();
    if (p.isConfigured()) return (cachedProvider = p);
  }
  // Auto-detect (prefer Foundry > Azure OpenAI > OpenAI > Mock)
  const fnd = new AzureFoundryProvider();
  if (fnd.isConfigured()) return (cachedProvider = fnd);
  const az = new AzureOpenAIProvider();
  if (az.isConfigured()) return (cachedProvider = az);
  const oa = new OpenAIProvider();
  if (oa.isConfigured()) return (cachedProvider = oa);
  return (cachedProvider = new MockProvider());
}

export function isLiveAIConfigured(): boolean {
  const p = getAIProvider();
  return p.name !== "mock";
}

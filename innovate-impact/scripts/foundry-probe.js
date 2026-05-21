// Quick probe: call the configured Azure Foundry Responses endpoint with the
// configured model using AzureCliCredential. Prints HTTP status, latency, and
// a short response excerpt so we can confirm the LLM is actually answering.
// Minimal .env loader (avoid adding dotenv as a dep)
const fs = require("fs");
const path = require("path");
try {
  const envPath = path.join(__dirname, "..", ".env");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
} catch {}
const { AzureCliCredential } = require("@azure/identity");

(async () => {
  const endpoint = process.env.AZURE_FOUNDRY_RESPONSES_ENDPOINT;
  const model = process.env.AZURE_FOUNDRY_MODEL;
  if (!endpoint || !model) {
    console.error("Missing AZURE_FOUNDRY_RESPONSES_ENDPOINT or AZURE_FOUNDRY_MODEL");
    process.exit(2);
  }
  console.log("Endpoint:", endpoint);
  console.log("Model   :", model);

  const cred = new AzureCliCredential();
  const scope = process.argv[2] || "https://ai.azure.com/.default";
  console.log("Scope   :", scope);
  const t0 = Date.now();
  const tok = await cred.getToken(scope);
  console.log(`Token acquired in ${Date.now() - t0} ms (len=${tok.token.length}).`);

  const body = {
    model,
    input: [
      { type: "message", role: "system", content: "Reply ONLY with JSON: {\"ok\": true, \"echo\": <number>}" },
      { type: "message", role: "user", content: "Echo the number 42." }
    ],
    text: { format: { type: "json_object" } }
  };

  const t1 = Date.now();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tok.token}`
    },
    body: JSON.stringify(body)
  });
  const ms = Date.now() - t1;
  const text = await res.text();
  console.log(`HTTP ${res.status} in ${ms} ms`);
  console.log(text.slice(0, 800));
})().catch((e) => {
  console.error("Probe failed:", e.message);
  process.exit(1);
});

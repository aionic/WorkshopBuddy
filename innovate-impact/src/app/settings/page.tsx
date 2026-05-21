import { isLiveAIConfigured, getAIProvider } from "@/lib/ai/provider";
import { Card, CardHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const live = isLiveAIConfigured();
  const provider = getAIProvider();
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <Card>
        <CardHeader title="AI provider" subtitle="Configured via environment variables" />
        <div className="text-sm space-y-2">
          <div className="flex items-center gap-2">Provider: <Badge tone={live ? "success" : "warn"}>{provider.name}</Badge></div>
          <div>AI_PROVIDER env: <code className="text-accent">{process.env.AI_PROVIDER || "(unset — auto-detect)"}</code></div>
          <div className="pt-2 border-t border-slate-800/60 mt-2">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Azure AI Foundry (Entra-only)</div>
            <div>Responses endpoint: <code className="text-accent break-all">{process.env.AZURE_FOUNDRY_RESPONSES_ENDPOINT || "(not set)"}</code></div>
            <div>Model: <code className="text-accent">{process.env.AZURE_FOUNDRY_MODEL || "(not set)"}</code></div>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Azure OpenAI (key-based, legacy)</div>
            <div>Endpoint: <code className="text-accent">{process.env.AZURE_OPENAI_ENDPOINT || "(not set)"}</code></div>
            <div>Deployment: <code className="text-accent">{process.env.AZURE_OPENAI_DEPLOYMENT || "(not set)"}</code></div>
            <div>API version: <code className="text-accent">{process.env.AZURE_OPENAI_API_VERSION || "(default)"}</code></div>
          </div>
          <p className="text-slate-400 text-xs mt-3">
            For the Foundry path the runtime identity must have role <strong>Cognitive Services User</strong> on the Foundry
            account. Locally, run <code>az login</code>; in Azure Container Apps the system-assigned managed identity is used.
            Restart the app after editing <code>.env</code>.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Export branding" subtitle="Applied to downloadable artifacts" />
        <p className="text-sm text-slate-300">Default branding: <strong>Workshop Buddy</strong>. Document footer includes artifact type, version, and page number.</p>
      </Card>

      <Card>
        <CardHeader title="Demo mode" />
        <p className="text-sm text-slate-300">Demo mode is <Badge tone={process.env.DEMO_MODE === "true" ? "success" : "default"}>{process.env.DEMO_MODE === "true" ? "ON" : "OFF"}</Badge>. The seeded OCR-to-GenAI project is available on the dashboard.</p>
        <p className="text-xs text-slate-500 mt-2">Reset seed data by running <code>npm run db:reset</code>.</p>
      </Card>
    </div>
  );
}

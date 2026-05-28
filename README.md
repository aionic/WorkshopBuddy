<div align="center">

<img src="./public/workshop-buddy-logo.png" alt="Workshop Buddy" width="240" />

# Workshop Buddy

**Delivering AI-Powered Solution Design at Enterprise Speed.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Azure Container Apps](https://img.shields.io/badge/Azure-Container%20Apps-0078D4?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/products/container-apps)
[![Azure AI Foundry](https://img.shields.io/badge/Azure%20AI-Foundry-7E57C2?logo=microsoftazure&logoColor=white)](https://ai.azure.com/)
[![azd](https://img.shields.io/badge/Deploy-azd%20up-1f6feb?logo=microsoftazure&logoColor=white)](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with GitHub Copilot](https://img.shields.io/badge/Built%20with-GitHub%20Copilot-8957e5?logo=github&logoColor=white)](https://github.com/features/copilot)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

**Maintained by** [@jamesbas](https://github.com/jamesbas) · [@aionic](https://github.com/aionic)

</div>

Turn live discovery conversations into executive-ready solution artifacts in minutes — impact statements, executive briefings, solution maps, 90-day execution plans, KPI frameworks, trend white papers, and developer-ready **Application Spec** briefs for vibe coding in VS Code + GitHub Copilot.

> Hosted by **Microsoft**. Single Next.js + TypeScript app, Prisma + Azure Postgres Flexible Server (Entra-only), 11-agent orchestrator behind a Service Bus queue, packaged for Azure Container Apps.

---

## Quickstart (5 minutes, demo mode)

Requires Node.js 20+. No Azure account needed for demo mode.

```bash
git clone <this-repo> WorkshopBuddy
cd WorkshopBuddy
cp .env.example .env       # leave AI_PROVIDER unset for demo mode
npm install                # runs `prisma generate`
npm run dev                # http://localhost:3000
```

You'll see the seeded **OCR to GenAI Document Intelligence Modernization** project. Click **Open** → **Workshop** → add inputs → **Run Full Workflow** → preview & download artifacts.

In demo mode the orchestrator produces deterministic content grounded in your workshop inputs — every screen and download works end-to-end without any AI keys.

> **Note:** the default `DATABASE_URL` in [.env.example](.env.example) points at the live Azure Postgres server. For purely local dev with no Azure dependency, point `DATABASE_URL` at a local Postgres instance and run `npm run db:push && npm run db:seed`.

---

## Quickstart with AI

Pick one provider, drop into `.env`, restart `npm run dev`.

### Azure AI Foundry (recommended — Entra-only, no API keys)

```bash
AI_PROVIDER=azure_foundry
AZURE_FOUNDRY_RESPONSES_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>/openai/v1/responses
AZURE_FOUNDRY_MODEL=gpt-5.4
```

Uses `DefaultAzureCredential` against the `https://ai.azure.com/.default` scope (`az login` locally; UAMI in ACA).

### Azure OpenAI (key)

```bash
AI_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### OpenAI

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

---

## Deploy to Azure (one command)

Requires the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) and `az login`.

```bash
azd up
```

That provisions a fresh resource group `rg-<env-name>` with everything from scratch: ACR, Log Analytics, Container Apps environment, User-Assigned Managed Identity, Postgres Flexible Server (Entra-only), Azure AI Foundry account + model deployment, Service Bus namespace + `agent-runs` queue, web Container App + worker/sweeper Container Apps Jobs, and Entra Easy Auth (single-tenant app registration + redirect URI). See [docs/deployment.md](docs/deployment.md) for the full walkthrough, hooks, and rollback procedure.

Subsequent deploys: `azd deploy` builds + pushes a new image, the `predeploy` hook runs `prisma migrate deploy`, and the `postdeploy` hook re-tags worker and sweeper to the new image.

```bash
docker compose up --build   # local container, http://localhost:3000
```

---

## Repository layout

```text
.
├── azure.yaml                       # azd service + hooks
├── Dockerfile                       # multi-stage Next.js standalone build
├── start.js                         # container boot: probe DB → seed → next start
├── infra/                           # Bicep (subscription-scope main.bicep + resources.bicep)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                  # versioned migrations (P0-3)
│   └── seed.{ts,js}                 # idempotent demo project seed
├── public/                          # logos, branding
├── scripts/                         # foundry-probe, pg-probe, list-tables, with-utf8 wrapper
├── src/
│   ├── app/                         # Next.js App Router (pages + /api routes)
│   ├── components/                  # AppShell, intake wizard, workshop board, agent canvas, artifact workspace
│   └── lib/
│       ├── agents/                  # orchestrator, agent-prompts, transcript-intake, queue, persist-artifacts
│       ├── ai/provider.ts           # Foundry / Azure OpenAI / OpenAI / mock provider abstraction
│       ├── api/                     # parse-body, schemas (zod), response helpers
│       ├── artifacts/               # markdown/docx/pptx renderers + artifact schemas
│       ├── prompts/                 # system + packager prompts (Markdown)
│       ├── transcripts/parse.ts     # docx/pdf/vtt/srt/txt/md transcript parser
│       ├── auth.ts                  # Easy Auth header decode + access helpers
│       ├── db.ts                    # Prisma + driver adapter w/ Entra token refresh
│       ├── env.ts                   # lazy zod env proxy
│       └── workshop-enums.ts        # CATEGORIES / PERSONAS / PRIORITIES
├── worker/
│   ├── agent-run-worker.ts          # Service Bus consumer (Container Apps Job)
│   └── sweeper.js                   # cron job: marks stuck Running runs as Failed
└── docs/
    ├── architecture.md              # code structure + data flow + auth model
    ├── agents.md                    # 11-agent orchestration + handoff Mermaid
    ├── ui-flows.md                  # primary nav + workshop → agents → artifacts flow
    ├── azure-architecture.md        # ACA + Postgres + Foundry + Service Bus topology
    ├── deployment.md                # azd walkthrough + Bicep notes + rollback
    ├── transcript-ingest.md         # transcript intake design + format support
    ├── samples/                     # sample transcripts for live demos
    └── spec/InnovateImpact.md       # full product requirements spec
```

See [docs/architecture.md](docs/architecture.md) for the architectural deep-dive and [docs/agents.md](docs/agents.md) for the agent flow diagram.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Code structure, data flow, auth model, persistence |
| [docs/agents.md](docs/agents.md) | 11-agent orchestrator + handoff Mermaid diagram |
| [docs/ui-flows.md](docs/ui-flows.md) | Primary navigation + workshop-to-artifact user flow |
| [docs/azure-architecture.md](docs/azure-architecture.md) | ACA + Postgres + Foundry + Service Bus topology |
| [docs/deployment.md](docs/deployment.md) | `azd up` walkthrough, hooks, secrets, rollback |
| [docs/transcript-ingest.md](docs/transcript-ingest.md) | Transcript Intake Agent design + formats |
| [docs/buddy-intro-email.md](docs/buddy-intro-email.md) | Stakeholder intro email template |
| [docs/spec/InnovateImpact.md](docs/spec/InnovateImpact.md) | Original product requirements spec |
| [docs/samples/](docs/samples/) | Sample transcripts for live demos |

---

## Maintainers

| | Maintainer | Focus |
| --- | --- | --- |
| <img src="https://avatars.githubusercontent.com/u/53447387?v=4" width="40" /> | [**@jamesbas**](https://github.com/jamesbas) | Product vision, agent design, Azure AI Foundry |
| <img src="https://avatars.githubusercontent.com/u/9543466?v=4" width="40" /> | [**@aionic**](https://github.com/aionic) | Architecture, infra (Bicep/azd), DX |

For issues, ideas, or PRs — tag a maintainer or open an issue. See [docs/architecture.md](docs/architecture.md) for the codebase tour before diving into a non-trivial change.

## Contributing

PRs welcome. Please:

1. Open an issue first for anything larger than a bugfix.
2. Run `npx tsc --noEmit` and `npm run lint` before pushing.
3. Add or update a docs/ page if you change architecture, infra, or the agent graph.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).

---

## Notes

- AI-drafted content requires human review and approval before client use. The disclaimer appears in the UI and in every generated artifact.
- API keys are read from environment variables only and are never logged.
- The MVP intentionally omits enterprise RBAC, real-time collaboration, and approval workflows. See `BACKLOG.md` (local-only) for the prioritized backlog.
- Hosted by **Microsoft**.

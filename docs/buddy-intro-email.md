# Workshop Buddy — Intro for the Microsoft Sales Team

![Workshop Buddy](../public/workshop-buddy-logo.png)

**Live demo:** <https://workshopbuddy-app.salmonbush-45627890.eastus.azurecontainerapps.io>
**Repo:** <https://github.com/jamesbas/WorkshopBuddy>

---

## Executive summary

Workshop Buddy is an internal Microsoft demo application that turns a customer
discovery conversation into a complete, executive-ready solution package — in
minutes, not weeks. Built on **Next.js + Azure Container Apps + Azure Database
for PostgreSQL Flexible Server** and powered by **Azure AI Foundry (GPT-5.4,
Entra-only auth)**, it runs an 11-agent orchestration that converts raw
workshop sticky notes — pain points, opportunities, voice-of-customer quotes,
KPI targets — into seven branded deliverables:

1. **Impact Statement** — the elevator pitch for the executive sponsor.
2. **Executive Briefing Deck** (PPTX) — a board-ready story arc.
3. **Solution Map** — the target architecture and capability blueprint.
4. **90-Day Execution Plan** — phased roadmap with owners and exit criteria.
5. **KPI Framework** — measurable business outcomes tied to the solution.
6. **Trends White Paper** — industry context and "why now" narrative.
7. **Application Spec** — a developer-grade "vibe coding" brief ready to paste
   into VS Code + GitHub Copilot to scaffold a working prototype.

Every artifact is downloadable as Markdown, DOCX, or PPTX, fully editable, and
regenerable with custom facilitator instructions ("audience is the CFO; lead
with cost reduction"). The result: **what used to take a solution architect a
week of after-hours work now ships before the customer's coffee gets cold.**

The strategic payoff for our team is acceleration of the customer journey from
*discovery* directly into *proof of concept*. Workshop Buddy collapses the
"send you a write-up next week" gap, keeps the deal in motion, and de-risks
the POC by handing developers a structured spec on day one.

---

## Why this matters for the Microsoft Sales team

### 1. Win the room while you're still in it

The most expensive part of any solution sale is the silence between the
discovery workshop and the follow-up deliverable. Workshop Buddy closes that
gap. Open the app on the projector, capture the customer's own words on the
**Workshop Board**, hit **Run Full Workflow**, and within minutes the customer
is reviewing *their* impact statement, *their* KPIs, and *their* 90-day plan —
co-edited live. We leave the room with a signed-off direction instead of a
promise to "circle back."

### 2. Move from discovery to POC in the same week

Every deliverable Workshop Buddy generates is engineered to accelerate the
next step:

- The **Solution Map** gives the customer's architects something concrete to
  react to (and gives our CSAs a starting point for the POC scope).
- The **90-Day Execution Plan** anchors the conversation to a real timeline so
  the customer's PMO can secure budget and resources immediately.
- The **Application Spec** — the differentiator — is a ready-to-build brief
  that a developer can paste straight into GitHub Copilot in VS Code and start
  generating working code the same afternoon. We have literally bootstrapped
  a working POC from a discovery conversation in a single business day.

### 3. Consistency, brand, and compliance — without the heroics

Every artifact is rendered through the same templated pipeline, branded as
Microsoft, with a built-in human-review disclaimer. No more "which version of
the slide template was that?" or off-brand decks getting into customer hands.
Every output is reviewable, regenerable, and editable before it leaves the
room.

### 4. Built on the stack we sell

Workshop Buddy is a working reference for the Microsoft AI platform itself:

- **Azure AI Foundry** with the GPT-5.4 model deployment (Entra-only — no API
  keys anywhere in the system).
- **Azure Container Apps** + **Azure Container Registry** + **Log Analytics**
  for the runtime.
- **Azure Database for PostgreSQL Flexible Server** with `passwordAuth: Disabled`
  and managed-identity-only access — a clean example of the security posture
  customers ask us about.
- **Bicep + one-command PowerShell deploy** into a single resource group.

It is a sales tool *and* a credible architecture reference customers can pick
up and study. When a CTO asks "how would I build this on Azure?", you hand
them the repo.

### 5. The 11-agent workflow is the demo

For technical audiences (CTO, head of architecture, head of data), the agent
canvas itself is the talk-track:

> Intake → Pain Points → Business Impact → Solution Concept → Architecture →
> KPIs → Roadmap → Executive Story → Packager → Application Spec → Review

Each step has its own grounded system prompt, JSON schema, and Review agent
that scores the output on a 0-100 rubric. It's a tangible answer to "what
does an enterprise multi-agent workflow on Azure actually look like?" — and
it opens doors to follow-on conversations about agent platforms, AI Foundry,
and Copilot Studio.

---

## How to use Workshop Buddy on a customer engagement

| Stage | What you do | What the customer leaves with |
|---|---|---|
| **Pre-call** | Create a project in 30 seconds (name, industry, sponsor, success criteria). Seed a demo project if you want a backup. | A clean canvas, branded with their logo and context. |
| **Live workshop** | Capture inputs on the Workshop Board as the customer speaks — pain points, opportunities, KPI targets, customer quotes. | Their own words, prioritized and voteable. |
| **In-session generation** | Pick which artifacts you want, add custom instructions ("audience is the CIO"), and run the workflow. | An impact statement, briefing deck, solution map, KPIs, roadmap, and Application Spec — live, in the meeting. |
| **Wrap-up** | Walk through the briefing deck, edit anything inline, regenerate sections on demand. | Downloads in Markdown / DOCX / PPTX, ready to send. |
| **Next 24h** | Hand the Application Spec to a dev (or to Copilot directly). | A working POC scaffold, the same week as the workshop. |

---

## Short version — email / Teams chat

> **Subject: Try Workshop Buddy — turn a discovery call into a POC the same week**
>
> Hi team — I want to put **Workshop Buddy** on your radar. It's a Microsoft
> internal app (Azure AI Foundry + GPT-5.4 on Azure Container Apps) that
> turns a live customer discovery conversation into a full set of
> executive-ready deliverables in minutes: Impact Statement, Executive
> Briefing Deck (PPTX), Solution Map, 90-Day Plan, KPI Framework, Trends
> Brief, and an **Application Spec** that a developer can paste into GitHub
> Copilot to scaffold a working prototype the same day.
>
> Why you'll care:
>
> - **No more "I'll send a write-up next week."** You walk out of the
>   workshop with the artifacts already in the customer's inbox.
> - **Accelerates discovery → POC.** The Application Spec is engineered to
>   hand straight to a dev or to Copilot in VS Code. We've gone from
>   workshop to working POC scaffold inside a single business day.
> - **On-brand, every time.** Branded as Microsoft, DOCX/PPTX downloads,
>   built-in human-review disclaimer, fully editable.
> - **It's also a great architecture demo** — Entra-only Postgres, managed
>   identity, Azure AI Foundry, Bicep one-command deploy. Customers love
>   poking at it.
>
> Live demo: <https://workshopbuddy-app.salmonbush-45627890.eastus.azurecontainerapps.io>
> Repo: <https://github.com/jamesbas/WorkshopBuddy>
>
> Happy to walk anyone through it — ping me and we'll set up 20 minutes.

---

## One-liner

> *Workshop Buddy turns a customer discovery call into seven executive-ready
> deliverables — including a developer-ready Application Spec — before the
> meeting ends, so we move from discovery to POC in the same week.*

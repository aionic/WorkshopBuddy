import Image from "next/image";
import { Card, CardHeader, Badge } from "@/components/ui";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Workflow,
  FileText,
  Settings as SettingsIcon,
  HelpCircle,
  Sparkles,
  Lightbulb,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-center">
        <Image
          src="/workshop-buddy-logo.png"
          alt="Workshop Buddy"
          width={320}
          height={320}
          priority
          className="rounded-2xl shadow-lg"
        />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-accent" /> Help &amp; User Guide
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Everything you need to take an idea from a workshop sticky note to a polished
          executive deliverable using Workshop Buddy.
        </p>
      </div>

      <Card>
        <CardHeader
          title="What this app does"
          subtitle="Innovation acceleration with a 10-agent AI workflow"
        />
        <div className="text-sm text-slate-300 space-y-2">
          <p>
            Workshop Buddy takes raw, unstructured workshop input — pain points,
            opportunities, customer quotes, KPI targets — and produces a polished set of
            executive deliverables: an <strong>Impact Statement</strong>, a{" "}
            <strong>Solution Map</strong>, an <strong>Executive Briefing</strong>, a{" "}
            <strong>90-Day Roadmap</strong>, a <strong>KPI Dashboard</strong>, and a{" "}
            <strong>Trends Brief</strong>.
          </p>
          <p>
            A 10-agent orchestrator (Intake → Pain Points → Business Impact → Solution Concept →
            Architecture → KPIs → Roadmap → Executive Story → Packager → Review) runs against
            your inputs. Each agent has its own dedicated system prompt and JSON output schema.
            The Packager assembles each requested artifact, then a Review agent scores quality
            on a 0-100 rubric. Every artifact can be regenerated, edited, and downloaded as
            <strong> Markdown</strong>, <strong>DOCX</strong>, or <strong>PPTX</strong>.
          </p>
          <p className="text-xs text-slate-400">
            AI provider: <Badge tone="success">Azure AI Foundry (GPT-5, Entra-only)</Badge>{" "}
            with deterministic demo fallback when no AI is configured.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="The 5-step facilitator flow" subtitle="Recommended path through the app" />
        <ol className="text-sm text-slate-300 space-y-3 list-decimal list-inside">
          <li>
            <strong>Create a project</strong> &mdash; on the{" "}
            <NavRef icon={FolderKanban} label="Projects" /> page click <em>New project</em>.
            Provide name, customer, industry, sponsor, and success criteria. A seeded demo
            project (<em>OCR to GenAI Document Intelligence Modernization</em>) is available
            out of the box for instant demos.
          </li>
          <li>
            <strong>Capture workshop input</strong> &mdash; open the project and go to{" "}
            <NavRef icon={Users} label="Workshop Studio" />. Add inputs as cards; each card has
            a category (pain point, opportunity, voice of customer, KPI target, etc.),
            optional persona, priority, and free-text content. Cards are editable in place,
            voteable, and can be deleted. <strong>New:</strong> click{" "}
            <em>Import from transcript</em> to paste a Teams transcript or upload a
            .docx/.pdf/.vtt/.srt/.txt file. The Transcript Intake Agent will propose
            categorized, persona-tagged candidate cards for you to review and accept in
            bulk &mdash; nothing is written to the board until you approve.
          </li>
          <li>
            <strong>Pick artifacts &amp; run the workflow</strong> &mdash; on{" "}
            <NavRef icon={Workflow} label="Agent Workflow" />, toggle which artifact types
            you want produced (the selection persists per project). Optionally add{" "}
            <em>custom facilitator instructions</em> in the prompt box (e.g. &ldquo;Audience
            is the CFO; lead with cost reduction&rdquo;) &mdash; this is appended to every
            agent&rsquo;s prompt for that run. Click <em>Run Full Workflow</em>.
          </li>
          <li>
            <strong>Review &amp; refine</strong> &mdash; each agent surfaces its output,
            confidence, and notes as it completes. The Review agent gives the run a quality
            score so facilitators know which sections may need more input.
          </li>
          <li>
            <strong>Edit and export</strong> &mdash; on{" "}
            <NavRef icon={FileText} label="Artifacts" />, preview each artifact, regenerate
            with new instructions, edit sections inline, version, and download as Markdown,
            DOCX, or PPTX. All exports include Workshop Buddy branding.
          </li>
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Page-by-page reference"
          subtitle="What each section of the app is for"
        />
        <div className="text-sm space-y-3">
          <PageRef icon={LayoutDashboard} title="Dashboard" href="/">
            Live counts of projects, workshop inputs, artifacts, and agent runs. Fast access
            to the most recently updated projects.
          </PageRef>
          <PageRef icon={FolderKanban} title="Projects" href="/projects">
            Browse, create, open, or delete projects. Each project has its own workshop
            inputs, agent runs, selected artifact types, and generated artifacts.
          </PageRef>
          <PageRef icon={Users} title="Workshop Studio" href="/workshop">
            Capture and organise raw workshop input. Pick a project from the dropdown, then
            add, edit, vote, or remove cards. Use this as a live capture surface during the
            workshop itself.
          </PageRef>
          <PageRef icon={Workflow} title="Agent Workflow" href="/agents">
            Run the 10-agent orchestrator end-to-end. Toggle which artifacts to produce, add
            optional facilitator instructions, then watch each agent complete in turn. Past
            runs are listed with score and timestamps.
          </PageRef>
          <PageRef icon={FileText} title="Artifacts" href="/artifacts">
            Preview, edit, regenerate, version, and download generated artifacts in Markdown,
            DOCX, and PPTX.
          </PageRef>
          <PageRef icon={SettingsIcon} title="Settings" href="/settings">
            Inspect the configured AI provider (Azure AI Foundry / Azure OpenAI / OpenAI /
            demo), branding info, and demo-mode status.
          </PageRef>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="The 10 agents"
          subtitle="Every agent has its own system prompt and JSON schema"
        />
        <div className="text-sm text-slate-300 space-y-2">
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Intake Clarification Agent</strong> &mdash; refines the brief into a single problem statement and outcome.</li>
            <li><strong>Pain Point Synthesis Agent</strong> &mdash; clusters and ranks pain points by severity and frequency.</li>
            <li><strong>Business Impact Agent</strong> &mdash; quantifies impact (revenue, cost, risk, CX, compliance).</li>
            <li><strong>Solution Concept Agent</strong> &mdash; proposes 1-3 solution concepts with rationales.</li>
            <li><strong>Architecture &amp; Solution Map Agent</strong> &mdash; turns concepts into a Microsoft / Azure-grounded reference architecture.</li>
            <li><strong>KPI &amp; Value Agent</strong> &mdash; defines leading and lagging KPIs and a value model.</li>
            <li><strong>Roadmap Agent</strong> &mdash; produces a phased 30 / 60 / 90-day roadmap with owners and milestones.</li>
            <li><strong>Executive Storytelling Agent</strong> &mdash; rewrites everything in CIO / CFO-ready narrative form.</li>
            <li><strong>Artifact Packager Agent</strong> &mdash; assembles each requested artifact (Impact Statement, Solution Map, etc.) with the right sections.</li>
            <li><strong>Review &amp; Quality Agent</strong> &mdash; scores the run on a 0-100 rubric and highlights gaps.</li>
          </ol>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/60">
            Want the full prompt text for each agent? See the{" "}
            <code className="text-accent">agent-prompts.md</code> file in the repository.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Tips &amp; troubleshooting" subtitle="Demo-day reliability" />
        <div className="text-sm text-slate-300 space-y-3">
          <Tip>
            <strong>Demo always works.</strong> If no AI provider is configured, the studio
            falls back to deterministic synthesis grounded in your workshop inputs &mdash; every
            screen, including artifact downloads, works end-to-end.
          </Tip>
          <Tip>
            <strong>Steer the run.</strong> Use the <em>Custom instructions</em> field on the
            Agent Workflow page to focus the entire 10-agent run on a specific audience,
            industry constraint, or outcome. Examples:
            <ul className="list-disc list-inside text-xs text-slate-400 mt-1 space-y-1">
              <li>&ldquo;Audience is the CFO; lead with TCO and payback period.&rdquo;</li>
              <li>&ldquo;Healthcare provider context; ensure HIPAA and PHI references.&rdquo;</li>
              <li>&ldquo;Position around Microsoft Fabric and Azure AI Foundry.&rdquo;</li>
            </ul>
          </Tip>
          <Tip>
            <strong>Regenerate sections, not the whole artifact.</strong> On the Artifacts
            page, edit a single section&rsquo;s prompt and regenerate just that section. The
            remainder of the artifact stays intact.
          </Tip>
          <Tip>
            <strong>Selected artifacts persist.</strong> The artifact selector on the Agent
            Workflow page is saved per project, so reopening the project always brings you
            back to the last configuration.
          </Tip>
          <Tip>
            <strong>Long-running workflow.</strong> A full 6-artifact run can produce 15+ LLM
            calls. If a run appears stuck, give it up to 90 seconds before refreshing.
            Network or token errors fall back to the deterministic demo synthesis automatically.
          </Tip>
        </div>
      </Card>

      <Card>
        <CardHeader title="Where to learn more" />
        <div className="text-sm text-slate-300 space-y-2">
          <p>
            <strong>README.md</strong> &mdash; full setup, AI provider configuration, infra
            layout, and deployment instructions for Azure Container Apps.
          </p>
          <p>
            <strong>agent-prompts.md</strong> &mdash; per-agent system prompts and JSON output
            schemas, plus how custom facilitator instructions flow into every agent.
          </p>
          <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-2 border-t border-slate-800/60">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            AI-drafted content always requires human review before sharing with customers.
          </p>
        </div>
      </Card>

      <div className="text-center text-xs text-slate-500 pt-2">
        Workshop Buddy <span className="text-slate-400">v2.0.0</span>
      </div>
    </div>
  );
}

function NavRef({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-200 text-xs font-medium">
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function PageRef({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-md bg-accent/10 text-accent grid place-items-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="font-medium text-white">
          {title}{" "}
          <code className="ml-1 text-[11px] font-normal text-slate-500">{href}</code>
        </div>
        <div className="text-slate-400">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Lightbulb className="w-4 h-4 text-accent mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parsePastedText,
  parseTranscriptUpload,
  TranscriptParseError,
} from "@/lib/transcripts/parse";
import { runTranscriptIntakeAgent } from "@/lib/agents/transcript-intake";
import { withProjectAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type ExtractResponse = {
  ingestId: string;
  cards: ReturnType<typeof toJsonReady>;
  usedLLM: boolean;
  llmError?: string;
  format: string;
  charLength: number;
  durationMs: number;
};

function toJsonReady(cards: Awaited<ReturnType<typeof runTranscriptIntakeAgent>>["cards"]) {
  return cards.map((c) => ({ ...c }));
}

function parseOutcomes(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const POST = withProjectAuth(async (req, { params }) => {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  let text = "";
  let format = "text";
  let filename: string | undefined;
  let hints: string | undefined;
  let source: "paste" | "upload" = "paste";

  try {
    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pastedText = form.get("text");
      hints = typeof form.get("hints") === "string" ? (form.get("hints") as string) : undefined;

      if (file instanceof File && file.size > 0) {
        const parsed = await parseTranscriptUpload(file);
        text = parsed.text;
        format = parsed.format;
        filename = parsed.filename;
        source = "upload";
      } else if (typeof pastedText === "string" && pastedText.trim()) {
        const parsed = parsePastedText(pastedText);
        text = parsed.text;
        format = parsed.format;
      } else {
        return NextResponse.json({ error: "No file or text provided" }, { status: 400 });
      }
    } else {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object" || typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json({ error: "Body must include non-empty `text`" }, { status: 400 });
      }
      hints = typeof body.hints === "string" ? body.hints : undefined;
      const parsed = parsePastedText(body.text);
      text = parsed.text;
      format = parsed.format;
    }
  } catch (err) {
    if (err instanceof TranscriptParseError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Failed to parse transcript";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (text.length < 60) {
    return NextResponse.json(
      { error: "Transcript is too short to extract meaningful cards (need at least ~60 characters)." },
      { status: 400 },
    );
  }

  const result = await runTranscriptIntakeAgent(
    text,
    {
      name: project.name,
      industry: project.industry,
      businessProblem: project.businessProblem,
      desiredOutcomes: parseOutcomes(project.desiredOutcomes),
    },
    hints,
  );

  const ingest = await prisma.transcriptIngest.create({
    data: {
      projectId: project.id,
      source,
      filename,
      format,
      charLength: text.length,
      cardsProposed: result.cards.length,
      cardsAccepted: 0,
      usedLLM: result.usedLLM,
      llmError: result.llmError,
      hints,
    },
  });

  // Lightweight telemetry — no transcript content logged.
  console.log(
    `[transcript-intake] project=${project.id} ingest=${ingest.id} source=${source} format=${format} chars=${text.length} cards=${result.cards.length} usedLLM=${result.usedLLM} durationMs=${result.durationMs}` +
      (result.llmError ? ` llmError="${result.llmError.slice(0, 200)}"` : ""),
  );

  const payload: ExtractResponse = {
    ingestId: ingest.id,
    cards: toJsonReady(result.cards),
    usedLLM: result.usedLLM,
    llmError: result.llmError,
    format,
    charLength: text.length,
    durationMs: result.durationMs,
  };

  return NextResponse.json(payload, { status: 200 });
});

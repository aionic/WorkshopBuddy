import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isCategory,
  isPersona,
  isPriority,
} from "@/lib/workshop-enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BatchItem = {
  category: string;
  persona?: string | null;
  priority?: string;
  content: string;
  submittedBy?: string | null;
};

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
    return NextResponse.json({ error: "Body must be { items: [...] }" }, { status: 400 });
  }

  const transcriptIngestId =
    typeof (body as { transcriptIngestId?: unknown }).transcriptIngestId === "string"
      ? ((body as { transcriptIngestId?: string }).transcriptIngestId as string)
      : null;

  if (transcriptIngestId) {
    const ingest = await prisma.transcriptIngest.findUnique({ where: { id: transcriptIngestId } });
    if (!ingest || ingest.projectId !== project.id) {
      return NextResponse.json({ error: "transcriptIngestId does not belong to this project" }, { status: 400 });
    }
  }

  const items = (body as { items: BatchItem[] }).items;
  if (items.length === 0) {
    return NextResponse.json({ error: "items[] is empty" }, { status: 400 });
  }
  if (items.length > 100) {
    return NextResponse.json({ error: "Cannot batch more than 100 items at a time" }, { status: 400 });
  }

  const rows: Array<{
    projectId: string;
    category: string;
    persona: string | null;
    priority: string;
    content: string;
    submittedBy: string;
    transcriptIngestId: string | null;
  }> = [];
  const errors: Array<{ index: number; reason: string }> = [];

  items.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      errors.push({ index, reason: "not an object" });
      return;
    }
    const content = typeof raw.content === "string" ? raw.content.trim() : "";
    if (!content) {
      errors.push({ index, reason: "content is required" });
      return;
    }
    if (!isCategory(raw.category)) {
      errors.push({ index, reason: `invalid category "${raw.category}"` });
      return;
    }
    const persona = raw.persona == null || raw.persona === "" ? null : isPersona(raw.persona) ? raw.persona : null;
    const priority = isPriority(raw.priority) ? raw.priority : "Medium";
    const submittedBy = typeof raw.submittedBy === "string" && raw.submittedBy.trim()
      ? raw.submittedBy.trim()
      : "Transcript Intake";

    rows.push({
      projectId: project.id,
      category: raw.category,
      persona,
      priority,
      content: content.slice(0, 2000),
      submittedBy,
      transcriptIngestId,
    });
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid items", errors }, { status: 400 });
  }

  // createMany would be faster but returns only a count; we want the rows back
  // so the UI can append them to local state without a re-fetch.
  const created = await prisma.$transaction(rows.map((data) => prisma.workshopInput.create({ data })));

  if (transcriptIngestId) {
    await prisma.transcriptIngest.update({
      where: { id: transcriptIngestId },
      data: { cardsAccepted: { increment: created.length } },
    });
  }

  return NextResponse.json(
    { created: created.length, skipped: errors.length, errors, inputs: created },
    { status: 201 },
  );
}

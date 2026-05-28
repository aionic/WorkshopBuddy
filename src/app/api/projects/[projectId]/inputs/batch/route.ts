import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { inputBatchEnvelopeSchema, inputCreateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withProjectAuth(async (req, { project: projectMeta, params }) => {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  void projectMeta; // assertion-side project metadata; full row fetched above for downstream use.

  const envelope = await parseBody(req, inputBatchEnvelopeSchema);
  if (envelope instanceof NextResponse) return envelope;

  const transcriptIngestId = envelope.transcriptIngestId ?? null;
  if (transcriptIngestId) {
    const ingest = await prisma.transcriptIngest.findUnique({ where: { id: transcriptIngestId } });
    if (!ingest || ingest.projectId !== project.id) {
      return NextResponse.json(
        { error: "transcriptIngestId does not belong to this project" },
        { status: 400 },
      );
    }
  }

  // Validate each item independently with the canonical inputCreate schema
  // so we can return partial-success (rows[] + errors[]) instead of
  // rejecting the entire batch on the first bad row.
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

  envelope.items.forEach((raw, index) => {
    const result = inputCreateSchema.safeParse(raw);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first?.path.map(String).join(".");
      errors.push({
        index,
        reason: path ? `${path}: ${first?.message}` : first?.message ?? "invalid item",
      });
      return;
    }
    const item = result.data;
    rows.push({
      projectId: project.id,
      category: item.category,
      persona: item.persona ?? null,
      priority: item.priority,
      content: item.content,
      submittedBy: item.submittedBy?.trim() || "Transcript Intake",
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
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { regenerateArtifact } from "@/lib/agents/orchestrator";
import type { ArtifactType } from "@/lib/artifacts/artifact-schemas";
import { assertArtifactAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export const POST = withAuth<[{ params: { artifactId: string } }]>(async (req, user, { params }) => {
  await assertArtifactAccess(params.artifactId, user);
  const body = (await req.json().catch(() => ({}))) as { revisionInstructions?: string };
  const existing = await prisma.artifact.findUnique({ where: { id: params.artifactId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: existing.projectId }, include: { inputs: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { content, markdown } = await regenerateArtifact(
    project as any,
    project.inputs as any,
    existing.markdown ?? "",
    existing.artifactType as ArtifactType,
    body.revisionInstructions ?? ""
  );

  await prisma.artifactVersion.create({
    data: { artifactId: existing.id, version: existing.currentVersion, contentJson: existing.contentJson, markdown: existing.markdown }
  });

  const updated = await prisma.artifact.update({
    where: { id: existing.id },
    data: {
      title: content.title,
      contentJson: JSON.stringify(content),
      markdown,
      currentVersion: existing.currentVersion + 1,
      status: "Draft"
    }
  });
  return NextResponse.json(updated);
});

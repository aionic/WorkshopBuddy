import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertArtifactAccess, withAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { artifactUpdateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: { artifactId: string } };

export const GET = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertArtifactAccess(params.artifactId, user);
  const artifact = await prisma.artifact.findUnique({
    where: { id: params.artifactId },
    include: { versions: { orderBy: { version: "desc" } } }
  });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(artifact);
});

export const PUT = withAuth<[Ctx]>(async (req, user, { params }) => {
  await assertArtifactAccess(params.artifactId, user);
  const parsed = await parseBody(req, artifactUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const existing = await prisma.artifact.findUnique({ where: { id: params.artifactId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.markdown !== undefined || parsed.contentJson !== undefined) {
    await prisma.artifactVersion.create({
      data: { artifactId: existing.id, version: existing.currentVersion, contentJson: existing.contentJson, markdown: existing.markdown }
    });
    data.currentVersion = existing.currentVersion + 1;
    if (parsed.markdown !== undefined) data.markdown = parsed.markdown;
    if (parsed.contentJson !== undefined) data.contentJson = JSON.stringify(parsed.contentJson);
  }
  const artifact = await prisma.artifact.update({ where: { id: params.artifactId }, data });
  return NextResponse.json(artifact);
});

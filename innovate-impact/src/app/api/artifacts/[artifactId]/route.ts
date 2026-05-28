import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertArtifactAccess, withAuth } from "@/lib/auth";

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
  const body = await req.json();
  const existing = await prisma.artifact.findUnique({ where: { id: params.artifactId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.status !== undefined) data.status = body.status;
  if (body.markdown !== undefined || body.contentJson !== undefined) {
    await prisma.artifactVersion.create({
      data: { artifactId: existing.id, version: existing.currentVersion, contentJson: existing.contentJson, markdown: existing.markdown }
    });
    data.currentVersion = existing.currentVersion + 1;
    if (body.markdown !== undefined) data.markdown = body.markdown;
    if (body.contentJson !== undefined) data.contentJson = JSON.stringify(body.contentJson);
  }
  const artifact = await prisma.artifact.update({ where: { id: params.artifactId }, data });
  return NextResponse.json(artifact);
});

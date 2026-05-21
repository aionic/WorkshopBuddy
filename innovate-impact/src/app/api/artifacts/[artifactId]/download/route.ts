import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderDocx } from "@/lib/artifacts/docx-renderer";
import { renderPptx } from "@/lib/artifacts/pptx-renderer";
import type { ArtifactContent } from "@/lib/artifacts/artifact-schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_.]+/gi, "_").slice(0, 80);
}

export async function GET(req: Request, { params }: { params: { artifactId: string } }) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "markdown").toLowerCase();

  const artifact = await prisma.artifact.findUnique({ where: { id: params.artifactId } });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const content = JSON.parse(artifact.contentJson) as ArtifactContent;
  const baseName = safeFilename(`${artifact.artifactType}_${artifact.title}_v${artifact.currentVersion}`);

  if (format === "markdown" || format === "md") {
    return new NextResponse(artifact.markdown ?? "", {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.md"`
      }
    });
  }

  if (format === "docx") {
    const buf = await renderDocx(content, artifact.artifactType, artifact.currentVersion);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`
      }
    });
  }

  if (format === "pptx") {
    const buf = await renderPptx(content, artifact.artifactType);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${baseName}.pptx"`
      }
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

/**
 * S-6: Shared "persist generated artifacts" routine used by both the web
 * fallback path (`/api/projects/[id]/agent-runs` in-process dev mode) and
 * the Container Apps Jobs worker. Previously this code was duplicated and
 * drifted; the result was subtle differences in error handling and version
 * bumping between web and worker code paths.
 *
 * With the (projectId, artifactType) unique constraint from S-1 we now use
 * a real upsert inside a transaction so the new ArtifactVersion row and the
 * Artifact mutation either both commit or both roll back.
 */
import { prisma } from "@/lib/db";
import type { ArtifactContent, ArtifactType } from "@/lib/artifacts/artifact-schemas";

export interface ArtifactPayload {
  artifactType: ArtifactType | string;
  content: ArtifactContent;
  markdown: string;
}

/**
 * Upsert each artifact by (projectId, artifactType). On update, snapshot the
 * pre-update state into ArtifactVersion and bump currentVersion. The snapshot
 * + update + bump run inside a single $transaction so a partial failure can
 * never leave a half-written history.
 */
export async function persistArtifacts(
  projectId: string,
  artifacts: ArtifactPayload[],
): Promise<void> {
  for (const a of artifacts) {
    const existing = await prisma.artifact.findUnique({
      where: { projectId_artifactType: { projectId, artifactType: a.artifactType } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.artifactVersion.create({
          data: {
            artifactId: existing.id,
            version: existing.currentVersion,
            contentJson: existing.contentJson,
            markdown: existing.markdown,
          },
        }),
        prisma.artifact.update({
          where: { id: existing.id },
          data: {
            title: a.content.title,
            contentJson: JSON.stringify(a.content),
            markdown: a.markdown,
            currentVersion: existing.currentVersion + 1,
            status: "Draft",
          },
        }),
      ]);
    } else {
      await prisma.artifact.create({
        data: {
          projectId,
          artifactType: a.artifactType,
          title: a.content.title,
          contentJson: JSON.stringify(a.content),
          markdown: a.markdown,
        },
      });
    }
  }
}

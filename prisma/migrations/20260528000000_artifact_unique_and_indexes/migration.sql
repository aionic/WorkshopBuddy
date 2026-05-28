-- S-1 + S-2: Enforce (projectId, artifactType) uniqueness and add hot-path indexes.
--
-- DUPLICATE CLEANUP (S-1):
-- The application has always treated (projectId, artifactType) as a logical key
-- ("upsert by type") but never had a DB-level unique constraint. If a race or
-- a bug ever produced duplicates, this migration would fail when the unique
-- index is built. The CTE below collapses any duplicates to the latest row
-- (max updatedAt) and removes the older copies along with their versions.
--
-- NOTE: This is destructive for accidentally-duplicated artifacts. Older
-- ArtifactVersion rows tied to the deleted Artifacts are also removed via the
-- cascade FK. Run on a backup if you want to preserve the duplicated history.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "artifactType"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "Artifact"
)
DELETE FROM "Artifact"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

-- CreateIndex (Project — owner dashboard list)
CREATE INDEX "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt" DESC);

-- CreateIndex (WorkshopInput — per-project list + transcript-ingest backref)
CREATE INDEX "WorkshopInput_projectId_createdAt_idx" ON "WorkshopInput"("projectId", "createdAt" DESC);
CREATE INDEX "WorkshopInput_transcriptIngestId_idx" ON "WorkshopInput"("transcriptIngestId");

-- CreateIndex (TranscriptIngest — FK lookup)
CREATE INDEX "TranscriptIngest_projectId_idx" ON "TranscriptIngest"("projectId");

-- CreateIndex (AgentRun — per-project history + sweeper status scan)
CREATE INDEX "AgentRun_projectId_createdAt_idx" ON "AgentRun"("projectId", "createdAt" DESC);
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status", "createdAt");

-- CreateIndex (Artifact — per-project list)
CREATE INDEX "Artifact_projectId_updatedAt_idx" ON "Artifact"("projectId", "updatedAt" DESC);

-- CreateIndex (ArtifactVersion — history view)
CREATE INDEX "ArtifactVersion_artifactId_version_idx" ON "ArtifactVersion"("artifactId", "version" DESC);

-- CreateUniqueIndex (S-1 enforcement)
CREATE UNIQUE INDEX "Artifact_projectId_artifactType_key" ON "Artifact"("projectId", "artifactType");

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ArtifactWorkspace } from "@/components/artifact-workspace";

export const dynamic = "force-dynamic";

export default async function ArtifactsPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { artifacts: { orderBy: { updatedAt: "desc" }, include: { versions: { orderBy: { version: "desc" } } } } }
  });
  if (!project) notFound();
  return <ArtifactWorkspace project={JSON.parse(JSON.stringify({ id: project.id, name: project.name, artifacts: project.artifacts }))} />;
}

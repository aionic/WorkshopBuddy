import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { WorkshopBoard } from "@/components/workshop-board";

export const dynamic = "force-dynamic";

export default async function WorkshopPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { inputs: { orderBy: { createdAt: "desc" } } }
  });
  if (!project) notFound();
  return <WorkshopBoard project={JSON.parse(JSON.stringify(project))} />;
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ArtifactsShortcut() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 10, include: { _count: { select: { artifacts: true } } } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Artifacts</h1>
      <p className="text-slate-400 text-sm">Pick a project to view its generated artifacts.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader title={p.name} subtitle={`${p._count.artifacts} artifacts`} />
            <Link href={`/projects/${p.id}/artifacts`}><Button>Open artifacts</Button></Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

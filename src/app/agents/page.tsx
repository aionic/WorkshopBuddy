import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentsShortcut() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 10 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Agent Workflow</h1>
      <p className="text-slate-400 text-sm">Pick a project to run its AI workflow.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader title={p.name} subtitle={p.clientName ?? p.industry ?? ""} />
            <Link href={`/projects/${p.id}/agents`}><Button>Open agents</Button></Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

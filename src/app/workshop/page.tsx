import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Button } from "@/components/ui";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkshopShortcutPage() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, take: 10 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Workshop Studio</h1>
      <p className="text-slate-400 text-sm">Pick a project to open its workshop board.</p>
      {projects.length === 0 ? (
        <Card><p className="text-slate-300">No projects yet. <Link href="/projects/new" className="text-accent hover:underline">Create one</Link>.</p></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader title={p.name} subtitle={p.clientName ?? p.industry ?? ""} />
              <Link href={`/projects/${p.id}/workshop`}><Button>Open workshop <ArrowRight className="w-4 h-4" /></Button></Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

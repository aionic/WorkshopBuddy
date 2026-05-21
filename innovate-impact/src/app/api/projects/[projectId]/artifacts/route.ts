import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json(artifacts);
}

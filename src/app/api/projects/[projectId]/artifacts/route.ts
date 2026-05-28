import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withProjectAuth(async (_req, { params }) => {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json(artifacts);
});

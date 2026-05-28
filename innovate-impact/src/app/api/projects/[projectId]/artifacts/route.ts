import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertProjectAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { projectId: string } };

export const GET = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json(artifacts);
});

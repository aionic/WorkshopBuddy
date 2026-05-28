import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertProjectAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { projectId: string } };

export const GET = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
  const inputs = await prisma.workshopInput.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(inputs);
});

export const POST = withAuth<[Ctx]>(async (req, user, { params }) => {
  await assertProjectAccess(params.projectId, user);
  const body = await req.json();
  if (!body?.content || !body?.category) {
    return NextResponse.json({ error: "category and content are required" }, { status: 400 });
  }
  const input = await prisma.workshopInput.create({
    data: {
      projectId: params.projectId,
      category: body.category,
      persona: body.persona ?? null,
      priority: body.priority ?? "Medium",
      content: body.content,
      submittedBy: body.submittedBy ?? user.name ?? user.upn ?? "Facilitator"
    }
  });
  return NextResponse.json(input, { status: 201 });
});

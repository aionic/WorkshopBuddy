import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withProjectAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { inputCreateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

export const GET = withProjectAuth(async (_req, { params }) => {
  const inputs = await prisma.workshopInput.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(inputs);
});

export const POST = withProjectAuth(async (req, { user, params }) => {
  const parsed = await parseBody(req, inputCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const input = await prisma.workshopInput.create({
    data: {
      projectId: params.projectId,
      category: parsed.category,
      persona: parsed.persona ?? null,
      priority: parsed.priority,
      content: parsed.content,
      submittedBy: parsed.submittedBy ?? user.name ?? user.upn ?? "Facilitator"
    }
  });
  return NextResponse.json(input, { status: 201 });
});

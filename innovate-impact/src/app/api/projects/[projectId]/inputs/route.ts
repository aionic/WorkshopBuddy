import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { projectId: string } }) {
  const inputs = await prisma.workshopInput.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(inputs);
}

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
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
      submittedBy: body.submittedBy ?? "Facilitator"
    }
  });
  return NextResponse.json(input, { status: 201 });
}

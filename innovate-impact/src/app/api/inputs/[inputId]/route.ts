import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { inputId: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["category", "persona", "priority", "content", "submittedBy"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const input = await prisma.workshopInput.update({ where: { id: params.inputId }, data });
  return NextResponse.json(input);
}

export async function DELETE(_: Request, { params }: { params: { inputId: string } }) {
  await prisma.workshopInput.delete({ where: { id: params.inputId } });
  return NextResponse.json({ ok: true });
}

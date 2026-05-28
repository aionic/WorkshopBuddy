import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertInputAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { inputId: string } };

export const PUT = withAuth<[Ctx]>(async (req, user, { params }) => {
  await assertInputAccess(params.inputId, user);
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["category", "persona", "priority", "content", "submittedBy"]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const input = await prisma.workshopInput.update({ where: { id: params.inputId }, data });
  return NextResponse.json(input);
});

export const DELETE = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertInputAccess(params.inputId, user);
  await prisma.workshopInput.delete({ where: { id: params.inputId } });
  return NextResponse.json({ ok: true });
});

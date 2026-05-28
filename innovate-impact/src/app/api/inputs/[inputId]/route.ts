import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertInputAccess, withAuth } from "@/lib/auth";
import { parseBody } from "@/lib/api/parse-body";
import { inputUpdateSchema } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: { inputId: string } };

export const PUT = withAuth<[Ctx]>(async (req, user, { params }) => {
  await assertInputAccess(params.inputId, user);
  const parsed = await parseBody(req, inputUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const data: Record<string, unknown> = {};
  for (const k of ["category", "persona", "priority", "content", "submittedBy"] as const) {
    const v = (parsed as Record<string, unknown>)[k];
    if (v !== undefined) data[k] = v;
  }
  const input = await prisma.workshopInput.update({ where: { id: params.inputId }, data });
  return NextResponse.json(input);
});

export const DELETE = withAuth<[Ctx]>(async (_req, user, { params }) => {
  await assertInputAccess(params.inputId, user);
  await prisma.workshopInput.delete({ where: { id: params.inputId } });
  return NextResponse.json({ ok: true });
});

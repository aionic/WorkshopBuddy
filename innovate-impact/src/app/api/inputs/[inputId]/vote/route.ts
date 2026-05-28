import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertInputAccess, withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth<[{ params: { inputId: string } }]>(async (_req, user, { params }) => {
  await assertInputAccess(params.inputId, user);
  const input = await prisma.workshopInput.update({
    where: { id: params.inputId },
    data: { votes: { increment: 1 } }
  });
  return NextResponse.json(input);
});

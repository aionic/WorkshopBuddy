import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { inputId: string } }) {
  const input = await prisma.workshopInput.update({
    where: { id: params.inputId },
    data: { votes: { increment: 1 } }
  });
  return NextResponse.json(input);
}

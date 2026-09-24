import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fees = await prisma.hiddenFee.findMany({
    where: { userId, dismissed: false },
    orderBy: { detectedAt: "desc" },
    include: { transaction: { select: { merchant: true, amount: true, date: true } } },
  });
  return NextResponse.json(fees);
}

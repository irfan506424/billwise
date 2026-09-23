import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.stripeAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, accountId: true, lastSyncedAt: true, createdAt: true },
  });
  return NextResponse.json(items);
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const acct = await prisma.stripeAccount.findUnique({ where: { id: Number(id) } });
  if (!acct || acct.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.transaction.deleteMany({ where: { userId, externalSource: "stripe" } });
  await prisma.stripeAccount.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

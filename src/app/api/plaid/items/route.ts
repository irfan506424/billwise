import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.plaidItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      itemId: true,
      institutionName: true,
      institutionId: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(items);
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const item = await prisma.plaidItem.findUnique({ where: { id: Number(id) } });
  if (!item || item.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Remove this item's synced transactions, then the item record.
  await prisma.transaction.deleteMany({ where: { userId, externalSource: "plaid" } });
  await prisma.plaidItem.delete({ where: { id: Number(id) } });
  await audit(userId, "plaid.disconnect", { targetType: "plaid_item", targetId: String(id) });
  return NextResponse.json({ ok: true });
}

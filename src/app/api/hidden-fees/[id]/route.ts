import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(_request: NextRequest, ctx: RouteContext<"/api/hidden-fees/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fee = await prisma.hiddenFee.findUnique({ where: { id: Number(id) } });
  if (!fee || fee.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.hiddenFee.update({ where: { id: Number(id) }, data: { dismissed: true } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/labels/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const label = await prisma.label.findUnique({ where: { id: Number(id) } });
  if (!label || label.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.label.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

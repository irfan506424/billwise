import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(_request: NextRequest, ctx: RouteContext<"/api/recommendations/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rec = await prisma.recommendation.findUnique({ where: { id: Number(id) } });
  if (!rec || rec.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.recommendation.update({
    where: { id: Number(id) },
    data: { dismissed: true },
  });
  return NextResponse.json(updated);
}

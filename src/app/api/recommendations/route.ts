import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const recs = await prisma.recommendation.findMany({
    where: { dismissed: false, userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(recs);
}

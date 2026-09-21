import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { labelCreateSchema, parseBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const labels = await prisma.label.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
  return NextResponse.json(labels);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(labelCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;
  const label = await prisma.label.create({ data: { name: v.name, color: v.color, userId } });
  return NextResponse.json(label, { status: 201 });
}

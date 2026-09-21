import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { recomputeAllFlags } from "@/lib/rules";
import { ruleCreateSchema, parseBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rules = await prisma.rule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(ruleCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  let categoryId: number | null = null;
  if (v.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: v.categoryId } });
    if (cat && cat.userId === userId) categoryId = cat.id;
  }

  const rule = await prisma.rule.create({
    data: {
      name: v.name,
      description: v.description ?? null,
      field: v.field,
      operator: v.operator,
      value: v.value,
      action: v.action,
      message: v.message,
      enabled: v.enabled,
      userId,
      categoryId,
    },
  });
  await recomputeAllFlags(userId);
  return NextResponse.json(rule, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { applyRulesToTransaction } from "@/lib/rules";
import { toDecimal } from "@/lib/format";
import { transactionCreateSchema, parseBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const where: Record<string, unknown> = { userId };
  const categoryId = sp.get("categoryId");
  if (categoryId) where.categoryId = Number(categoryId);
  const type = sp.get("type");
  if (type) where.type = type;
  const q = sp.get("q");
  if (q) where.merchant = { contains: q };

  const txs = await prisma.transaction.findMany({
    where,
    include: { category: true, labels: true, flags: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(txs);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = parseBody(transactionCreateSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  const tx = await prisma.transaction.create({
    data: {
      merchant: v.merchant,
      description: v.description ?? null,
      amount: toDecimal(v.amount),
      currency: v.currency,
      type: v.type,
      date: v.date ? new Date(v.date) : new Date(),
      source: v.source,
      rawText: v.rawText ?? null,
      lineItems: v.lineItems ? JSON.stringify(v.lineItems) : null,
      tax: v.tax != null ? toDecimal(v.tax) : null,
      userId,
      categoryId: v.categoryId ?? null,
      labels: v.labels.length
        ? {
            connectOrCreate: v.labels.map((name) => ({
              where: { userId_name: { userId, name } },
              create: { name, userId },
            })),
          }
        : undefined,
    },
    include: { category: true, labels: true },
  });

  await applyRulesToTransaction(tx.id, userId, {
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    labelNames: tx.labels.map((l) => l.name),
  });

  return NextResponse.json(tx, { status: 201 });
}

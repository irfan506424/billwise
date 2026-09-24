import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { applyRulesToTransaction } from "@/lib/rules";
import { toDecimal } from "@/lib/format";
import { transactionPatchSchema, parseBody } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(transactionPatchSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  const data: Record<string, unknown> = {};
  for (const k of ["merchant", "description", "currency", "type", "source", "rawText"] as const) {
    if (k in v) data[k] = v[k as keyof typeof v];
  }
  if ("amount" in v) data.amount = toDecimal(v.amount as number);
  if ("tax" in v) data.tax = v.tax != null ? toDecimal(v.tax as number) : null;
  if ("date" in v) data.date = new Date(v.date as string);
  if ("categoryId" in v) data.categoryId = v.categoryId ?? null;
  if ("lineItems" in v) data.lineItems = v.lineItems ? JSON.stringify(v.lineItems) : null;

  if (Array.isArray(v.labels)) {
    data.labels = {
      set: [],
      connectOrCreate: (v.labels as string[]).map((name) => ({
        where: { userId_name: { userId, name } },
        create: { name, userId },
      })),
    };
  }

  const tx = await prisma.transaction.update({
    where: { id: Number(id) },
    data,
    include: { category: true, labels: true, flags: true },
  });

  await prisma.flag.deleteMany({ where: { transactionId: tx.id } });
  await applyRulesToTransaction(tx.id, userId, {
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    labelNames: tx.labels.map((l) => l.name),
  });

  const refreshed = await prisma.transaction.findUnique({
    where: { id: tx.id },
    include: { category: true, labels: true, flags: true },
  });
  return NextResponse.json(refreshed);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.transaction.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.delete({ where: { id: Number(id) } });
  await audit(userId, "transaction.delete", { targetType: "transaction", targetId: String(id) });
  return NextResponse.json({ ok: true });
}

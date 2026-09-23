import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { reviewTransactions, aiAvailable, type AIInsight } from "@/lib/ai";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type TxWithRelations = Prisma.TransactionGetPayload<{ include: { category: true; labels: true } }>;

function buildSummary(txs: TxWithRelations[]): string {
  const byMerchant = new Map<string, { count: number; total: number }>();
  const byCategory = new Map<string, number>();
  let totalSpend = 0;
  const lines: string[] = [];

  for (const t of txs) {
    if (t.type === "expense") totalSpend += Number(t.amount);
    const m = byMerchant.get(t.merchant) ?? { count: 0, total: 0 };
    m.count += 1;
    m.total += Number(t.amount);
    byMerchant.set(t.merchant, m);
    const cat = t.category?.name ?? "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(t.amount));
  }

  lines.push(`Total expenses: $${totalSpend.toFixed(2)} across ${txs.length} transactions.`);
  lines.push("\nSpend by category:");
  for (const [cat, amt] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${cat}: $${amt.toFixed(2)}`);
  }
  lines.push("\nTop merchants by spend:");
  const top = [...byMerchant.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 12);
  for (const [name, v] of top) {
    lines.push(`  ${name}: ${v.count} txns, $${v.total.toFixed(2)}`);
  }
  return lines.join("\n");
}

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!aiAvailable()) {
    return NextResponse.json(
      { error: "Set ANTHROPIC_API_KEY in .env to enable AI review. The rules engine still works without it." },
      { status: 400 },
    );
  }
  const txs = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true, labels: true },
    orderBy: { date: "desc" },
    take: 300,
  });
  if (txs.length === 0) {
    return NextResponse.json({ error: "No transactions to review yet. Add some bills first." }, { status: 400 });
  }
  const summary = buildSummary(txs);
  let insights: AIInsight[];
  try {
    insights = await reviewTransactions(summary);
  } catch (e) {
    const msg = (e as Error).message;
    logger.error({ event: "ai.review.error", message: msg });
    return NextResponse.json(
      { error: `AI review failed: ${msg}` },
      { status: 502 },
    );
  }

  await prisma.recommendation.createMany({
    data: insights.map((i: AIInsight) => ({
      title: i.title,
      body: i.body,
      category: i.category ?? null,
      potentialSavings: i.potentialSavings ?? null,
      severity: i.severity ?? "info",
      userId,
    })),
  });

  return NextResponse.json({ insights, summary });
}

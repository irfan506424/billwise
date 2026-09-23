import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { aggregateMonthly, aggregateByCategory, computeTotals } from "@/lib/analytics";
import { LineChart, PieChart, BarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const userId = await getUserId();
  if (!userId) return null;

  const txs = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const rows = txs.map((t) => ({
    amount: Number(t.amount),
    type: t.type,
    date: t.date,
    categoryName: t.category?.name ?? null,
  }));

  const monthly = aggregateMonthly(rows, 6);
  const byCategory = aggregateByCategory(rows);
  const totals = computeTotals(rows);
  const netSeries = monthly.map((m) => ({ month: m.month, net: m.income - m.expense }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm opacity-60">Your spending & earnings over the last 6 months.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total spend" value={formatCurrency(totals.totalSpend)} tone="neg" />
        <Stat label="Total earnings" value={formatCurrency(totals.totalIncome)} tone="pos" />
        <Stat label="Net" value={formatCurrency(totals.net)} tone={totals.net >= 0 ? "pos" : "neg"} />
        <Stat label="Transactions" value={String(totals.count)} />
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
        <h2 className="font-medium mb-3">Spend vs earnings</h2>
        <LineChart data={monthly} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="font-medium mb-3">Spend by category</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm opacity-60">No expenses to break down yet.</p>
          ) : (
            <PieChart data={byCategory} />
          )}
        </section>

        <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="font-medium mb-3">Monthly net cash flow</h2>
          <BarChart data={netSeries} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-500" : tone === "neg" ? "text-red-500" : "";
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="text-xs opacity-60">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getStats(userId: string) {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true, flags: true },
  });
  const expenses = txs.filter((t) => t.type === "expense");
  const income = txs.filter((t) => t.type === "income");
  const totalSpend = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);

  const byCategory = new Map<string, number>();
  for (const t of expenses) {
    const c = t.category?.name ?? "Uncategorized";
    byCategory.set(c, (byCategory.get(c) ?? 0) + Number(t.amount));
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const flagged = txs.filter((t) => t.flags.length > 0);

  const categories = await prisma.category.findMany({ where: { userId } });
  const budgetWarnings = categories
    .filter((c) => c.budget && Number(c.budget) > 0)
    .map((c) => ({
      name: c.name,
      budget: Number(c.budget),
      spent: byCategory.get(c.name) ?? 0,
      color: c.color,
    }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent / b.budget - a.spent / b.budget);

  return { totalSpend, totalIncome, topCategories, flagged, budgetWarnings, txCount: txs.length };
}

export default async function Dashboard() {
  const userId = await getUserId();
  if (!userId) return null; // middleware handles redirect
  const stats = await getStats(userId);
  const net = stats.totalIncome - stats.totalSpend;
  const maxCat = stats.topCategories[0]?.[1] ?? 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm opacity-60">Overview of your spend, budgets, and flagged transactions.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total spend" value={formatCurrency(stats.totalSpend)} tone="neg" />
        <Stat label="Total income" value={formatCurrency(stats.totalIncome)} tone="pos" />
        <Stat label="Net" value={formatCurrency(net)} tone={net >= 0 ? "pos" : "neg"} />
        <Stat label="Transactions" value={String(stats.txCount)} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="font-medium mb-4">Spend by category</h2>
          {stats.topCategories.length === 0 ? (
            <p className="text-sm opacity-60">No expenses yet.</p>
          ) : (
            <ul className="space-y-3">
              {stats.topCategories.map(([name, amt]) => (
                <li key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="tabular-nums">{formatCurrency(amt)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(amt / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="font-medium mb-4">Budgets</h2>
          {stats.budgetWarnings.length === 0 ? (
            <p className="text-sm opacity-60">Set budgets on categories to track here.</p>
          ) : (
            <ul className="space-y-3">
              {stats.budgetWarnings.map((b) => {
                const pct = Math.min(100, (b.spent / b.budget) * 100);
                const over = b.spent > b.budget;
                return (
                  <li key={b.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{b.name}</span>
                      <span className={`tabular-nums ${over ? "text-red-500" : ""}`}>
                        {formatCurrency(b.spent)} / {formatCurrency(b.budget)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : b.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/categories" className="text-sm text-indigo-500 hover:underline mt-4 inline-block">
            Manage budgets →
          </Link>
        </section>
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Flagged transactions</h2>
          <Link href="/review" className="text-sm text-indigo-500 hover:underline">
            AI review →
          </Link>
        </div>
        {stats.flagged.length === 0 ? (
          <p className="text-sm opacity-60">No rules matched yet. Add rules to flag spending.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {stats.flagged.slice(0, 8).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">{t.merchant}</div>
                  <div className="text-xs opacity-60">
                    {formatDate(t.date)} · {t.flags.length} flag{t.flags.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums">{formatCurrency(Number(t.amount))}</div>
                  <div className="text-xs opacity-60">{t.flags[0]?.reason}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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

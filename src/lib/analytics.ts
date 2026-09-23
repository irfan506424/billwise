// Pure aggregation helpers for the per-user finance insights.
// All functions take already-fetched transaction rows (no DB access) so they
// are trivially unit-testable.

export type TxRow = {
  amount: number; // stored as Decimal; callers convert via Number()
  type: string; // "expense" | "income"
  date: Date | string;
  categoryName: string | null;
};

// Validated categorical palette (see dataviz skill). Fixed order, never cycled.
// 9th+ series folds into "Other". Light + dark steps for both modes.
export const CATEGORY_PALETTE_LIGHT = [
  "#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948",
];
export const CATEGORY_PALETTE_DARK = [
  "#3987e5", "#008300", "#d55181", "#c98500", "#199e70", "#d95926", "#9085e9", "#e66767",
];
export const EXPENSE_COLOR_LIGHT = "#e34948"; // red slot
export const INCOME_COLOR_LIGHT = "#008300"; // green slot
export const EXPENSE_COLOR_DARK = "#e66767";
export const INCOME_COLOR_DARK = "#0ca30c";

export type MonthlyPoint = { month: string; expense: number; income: number };

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [, m] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(m) - 1] ?? key;
}

/** Build a contiguous last-N-months series with expense/income totals. */
export function aggregateMonthly(txs: TxRow[], months = 6, ref: Date = new Date()): MonthlyPoint[] {
  const buckets = new Map<string, { expense: number; income: number }>();

  // seed contiguous months ending at ref
  const base = new Date(ref.getFullYear(), ref.getMonth(), 1);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    buckets.set(ym(d), { expense: 0, income: 0 });
  }

  for (const t of txs) {
    const d = typeof t.date === "string" ? new Date(t.date) : t.date;
    const key = ym(d);
    const b = buckets.get(key);
    if (!b) continue; // outside the window
    const amt = Number(t.amount);
    if (t.type === "income") b.income += amt;
    else b.expense += amt;
  }

  return [...buckets.entries()].map(([key, v]) => ({
    month: monthLabel(key),
    expense: Math.round(v.expense * 100) / 100,
    income: Math.round(v.income * 100) / 100,
  }));
}

export type CategorySlice = { name: string; amount: number; colorIndex: number };

/** Expense-by-category, sorted desc, top 7 + "Other" fold. Returns colorIndex (0-7; Other = -1). */
export function aggregateByCategory(txs: TxRow[], topN = 7): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "income") continue;
    const name = t.categoryName || "Uncategorized";
    totals.set(name, (totals.get(name) ?? 0) + Number(t.amount));
  }
  const sorted = [...totals.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const head = sorted.slice(0, topN).map((s, i) => ({ ...s, colorIndex: i }));
  const tailSum = sorted.slice(topN).reduce((s, x) => s + x.amount, 0);
  if (tailSum > 0) head.push({ name: "Other", amount: Math.round(tailSum * 100) / 100, colorIndex: -1 });
  return head;
}

export type Totals = {
  totalSpend: number;
  totalIncome: number;
  net: number;
  count: number;
};

export function computeTotals(txs: TxRow[]): Totals {
  let totalSpend = 0;
  let totalIncome = 0;
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") totalIncome += amt;
    else totalSpend += amt;
  }
  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    net: Math.round((totalIncome - totalSpend) * 100) / 100,
    count: txs.length,
  };
}

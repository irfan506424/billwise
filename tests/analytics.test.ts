import { describe, it, expect } from "vitest";
import { aggregateMonthly, aggregateByCategory, computeTotals } from "@/lib/analytics";

const ref = new Date(2026, 8, 15); // Sep 15, 2026 (month is 0-indexed: 8 = Sep)

const txs = [
  // within the 6-month window (Apr-Sep 2026)
  { amount: 100, type: "expense", date: new Date(2026, 8, 2), categoryName: "Groceries" },
  { amount: 50, type: "expense", date: new Date(2026, 8, 3), categoryName: "Dining" },
  { amount: 2000, type: "income", date: new Date(2026, 7, 10), categoryName: "Income" },
  { amount: 300, type: "expense", date: new Date(2026, 5, 20), categoryName: "Groceries" },
  { amount: 75, type: "expense", date: new Date(2026, 4, 1), categoryName: "Shopping" },
  // outside the window (Jan 2026) — should be excluded from monthly
  { amount: 999, type: "expense", date: new Date(2026, 0, 5), categoryName: "Old" },
];

describe("aggregateMonthly", () => {
  it("returns a contiguous 6-month series ending at ref month", () => {
    const m = aggregateMonthly(txs, 6, ref);
    expect(m).toHaveLength(6);
    expect(m.map((p) => p.month)).toEqual(["Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
  });

  it("sums expenses and incomes per month and excludes out-of-window rows", () => {
    const m = aggregateMonthly(txs, 6, ref);
    const sep = m[5];
    expect(sep.month).toBe("Sep");
    expect(sep.expense).toBe(150); // 100 + 50
    expect(sep.income).toBe(0);
    const aug = m[4];
    expect(aug.income).toBe(2000);
    // Jan "Old" 999 is outside the window → not counted anywhere
    const totalExpense = m.reduce((s, p) => s + p.expense, 0);
    expect(totalExpense).toBe(100 + 50 + 300 + 75); // excludes 999
  });

  it("seeds zero buckets for months with no transactions", () => {
    const m = aggregateMonthly([], 6, ref);
    expect(m).toHaveLength(6);
    expect(m.every((p) => p.expense === 0 && p.income === 0)).toBe(true);
  });
});

describe("aggregateByCategory", () => {
  it("sums expenses by category, sorted desc, excludes income", () => {
    const slices = aggregateByCategory(txs);
    const groceries = slices.find((s) => s.name === "Groceries");
    expect(groceries?.amount).toBe(400); // 100 + 300
    // income excluded
    expect(slices.find((s) => s.name === "Income")).toBeUndefined();
  });

  it("folds beyond topN into Other", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      amount: 10 - i,
      type: "expense",
      date: new Date(2026, 8, 1),
      categoryName: `Cat${i}`,
    }));
    const slices = aggregateByCategory(many, 7);
    expect(slices).toHaveLength(8); // 7 + Other
    expect(slices[slices.length - 1].name).toBe("Other");
    expect(slices[slices.length - 1].colorIndex).toBe(-1);
  });

  it("assigns colorIndex by rank", () => {
    const slices = aggregateByCategory(txs);
    expect(slices[0].colorIndex).toBe(0);
    expect(slices[1].colorIndex).toBe(1);
  });

  it("returns no Other when categories <= topN", () => {
    const slices = aggregateByCategory(txs, 7);
    expect(slices.find((s) => s.name === "Other")).toBeUndefined();
  });
});

describe("computeTotals", () => {
  it("computes spend, income, net, count across all rows", () => {
    const t = computeTotals(txs);
    expect(t.totalSpend).toBe(100 + 50 + 300 + 75 + 999); // includes out-of-window
    expect(t.totalIncome).toBe(2000);
    expect(t.net).toBe(2000 - t.totalSpend);
    expect(t.count).toBe(txs.length);
  });
});

import { describe, it, expect } from "vitest";
import { detectHeuristics, type TxRow } from "@/lib/hiddenFees";

const tx = (over: Partial<TxRow> & { id?: number; merchant?: string; amount?: number; type?: string; date?: string }): TxRow => ({
  id: over.id ?? 1,
  merchant: over.merchant ?? "Acme",
  amount: over.amount ?? 10,
  type: over.type ?? "expense",
  date: over.date ?? "2026-09-01",
});

describe("detectHeuristics", () => {
  it("flags a fee-keyword merchant as a maintenance_fee", () => {
    const rows = [tx({ merchant: "acme monthly fee", amount: 5 })];
    const out = detectHeuristics(rows);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("maintenance_fee");
    expect(out[0].merchant).toBe("acme monthly fee");
    expect(out[0].estimatedMonthly).toBeCloseTo(5, 2);
  });

  it("flags 'interest' / 'apr' as interest", () => {
    const out = detectHeuristics([tx({ merchant: "card apr interest charge", amount: 23.5 })]);
    expect(out[0].type).toBe("interest");
  });

  it("flags 'late' / 'penalty' as late_fee", () => {
    const out = detectHeuristics([tx({ merchant: "bank late penalty", amount: 35 })]);
    expect(out[0].type).toBe("late_fee");
  });

  it("flags 'foreign' / 'fx' as foreign_fee", () => {
    const out = detectHeuristics([tx({ merchant: "card fx foreign transaction", amount: 2 })]);
    expect(out[0].type).toBe("foreign_fee");
  });

  it("flags a recurring same-amount charge as subscription_creep", () => {
    const rows = [
      tx({ merchant: "netflix", amount: 22.99, date: "2026-09-05" }),
      tx({ merchant: "netflix", amount: 22.99, date: "2026-08-05" }),
      tx({ merchant: "netflix", amount: 22.99, date: "2026-07-05" }),
    ];
    const out = detectHeuristics(rows);
    expect(out.find((d) => d.type === "subscription_creep")).toBeTruthy();
    expect(out[0].estimatedMonthly).toBeCloseTo(22.99, 2);
  });

  it("does not flag a one-off small charge", () => {
    const out = detectHeuristics([tx({ merchant: "coffee shop", amount: 4.25 })]);
    expect(out).toHaveLength(0);
  });

  it("dedupes by transactionId when a tx matches multiple heuristics", () => {
    // matches both fee-keyword (maintenance_fee) and recurring
    const rows = [
      tx({ id: 100, merchant: "saas monthly fee", amount: 9.99, date: "2026-09-01" }),
      tx({ id: 101, merchant: "saas monthly fee", amount: 9.99, date: "2026-08-01" }),
      tx({ id: 102, merchant: "saas monthly fee", amount: 9.99, date: "2026-07-01" }),
    ];
    const out = detectHeuristics(rows);
    // one row per transactionId, subscription_creep preferred (higher estimate)
    const ids = out.map((d) => d.transactionId).sort();
    expect(ids).toEqual([100, 101, 102]);
  });
});

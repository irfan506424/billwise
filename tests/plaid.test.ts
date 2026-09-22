import { describe, it, expect } from "vitest";
import { mapPlaidTx } from "@/lib/plaid";

describe("mapPlaidTx", () => {
  it("maps an outgoing (positive amount) transaction as an expense", () => {
    const m = mapPlaidTx({
      transaction_id: "tx-1",
      name: "STARBUCKS STORE 123",
      amount: 5.75,
      date: "2026-09-20",
      merchant_name: "Starbucks",
      iso_currency_code: "USD",
      pending: false,
    });
    expect(m.type).toBe("expense");
    expect(m.amount).toBeCloseTo(5.75, 2);
    expect(m.merchant).toBe("Starbucks");
    expect(m.description).toBe("STARBUCKS STORE 123");
    expect(m.currency).toBe("USD");
    expect(m.externalSource).toBe("plaid");
    expect(m.externalId).toBe("tx-1");
    expect(m.source).toBe("plaid");
  });

  it("maps an incoming (negative amount) transaction as income with a positive amount", () => {
    const m = mapPlaidTx({
      transaction_id: "tx-2",
      name: "PAYROLL ACME CORP",
      amount: -2600,
      date: "2026-09-15",
      merchant_name: "Acme Corp",
      iso_currency_code: "USD",
      pending: false,
    });
    expect(m.type).toBe("income");
    expect(m.amount).toBeCloseTo(2600, 2);
    expect(m.merchant).toBe("Acme Corp");
  });

  it("falls back to the transaction name when merchant_name is missing", () => {
    const m = mapPlaidTx({
      transaction_id: "tx-3",
      name: "UNKNOWN MERCHANT",
      amount: 12.0,
      date: "2026-09-19",
      merchant_name: null,
      iso_currency_code: "USD",
      pending: false,
    });
    expect(m.merchant).toBe("UNKNOWN MERCHANT");
  });

  it("handles zero amount as expense", () => {
    const m = mapPlaidTx({
      transaction_id: "tx-4",
      name: "ZERO",
      amount: 0,
      date: "2026-09-19",
      merchant_name: "Zero",
      iso_currency_code: "USD",
      pending: false,
    });
    expect(m.type).toBe("expense");
    expect(m.amount).toBe(0);
  });

  it("defaults currency to USD when missing", () => {
    const m = mapPlaidTx({
      transaction_id: "tx-5",
      name: "X",
      amount: 1,
      date: "2026-09-19",
      merchant_name: "X",
      iso_currency_code: null,
      pending: false,
    });
    expect(m.currency).toBe("USD");
  });
});

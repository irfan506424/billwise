import { describe, it, expect } from "vitest";
import {
  transactionCreateSchema,
  registerSchema,
  ruleCreateSchema,
  parseBody,
} from "@/lib/validation";

describe("transactionCreateSchema", () => {
  it("accepts a valid expense", () => {
    const r = parseBody(transactionCreateSchema, {
      merchant: "Coffee Bean",
      amount: "6.75",
      date: "2026-09-15",
      categoryId: 2,
      labels: ["Recurring"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amount).toBe(6.75);
  });

  it("rejects empty merchant", () => {
    const r = parseBody(transactionCreateSchema, { merchant: "", amount: 5 });
    expect(r.ok).toBe(false);
  });

  it("rejects non-numeric amount", () => {
    const r = parseBody(transactionCreateSchema, { merchant: "X", amount: "abc" });
    expect(r.ok).toBe(false);
  });

  it("applies defaults", () => {
    const r = parseBody(transactionCreateSchema, { merchant: "X", amount: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.type).toBe("expense");
      expect(r.value.source).toBe("manual");
      expect(r.value.currency).toBe("USD");
    }
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const r = parseBody(registerSchema, {
      email: "User@Example.com",
      password: "password123",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe("user@example.com"); // lowercased
  });

  it("rejects short password", () => {
    const r = parseBody(registerSchema, { email: "a@b.com", password: "short" });
    expect(r.ok).toBe(false);
  });

  it("rejects bad email", () => {
    const r = parseBody(registerSchema, { email: "not-an-email", password: "password123" });
    expect(r.ok).toBe(false);
  });
});

describe("ruleCreateSchema", () => {
  it("rejects invalid field/operator", () => {
    const r = parseBody(ruleCreateSchema, {
      name: "x",
      field: "bogus",
      operator: "contains",
      value: "y",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts a valid rule", () => {
    const r = parseBody(ruleCreateSchema, {
      name: "Amazon",
      field: "merchant",
      operator: "contains",
      value: "Amazon",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.action).toBe("flag");
  });
});

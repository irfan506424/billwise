import { describe, it, expect } from "vitest";
import { ruleMatches } from "@/lib/rules";
import { Prisma } from "@prisma/client";

// Build a Decimal the way Prisma does (it's a class with toString()).
const D = (n: number) => new Prisma.Decimal(n);

const baseTx = {
  merchant: "Amazon",
  description: "Impulse buy",
  amount: D(89.99),
  categoryId: 6,
  categoryName: "Shopping",
  labelNames: ["Impulse"],
};

describe("ruleMatches", () => {
  it("matches merchant contains (case-insensitive)", () => {
    expect(ruleMatches({ field: "merchant", operator: "contains", value: "amazon" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "merchant", operator: "contains", value: "ebay" }, baseTx)).toBe(false);
  });

  it("matches description contains", () => {
    expect(ruleMatches({ field: "description", operator: "contains", value: "impulse" }, baseTx)).toBe(true);
  });

  it("matches amount comparisons", () => {
    expect(ruleMatches({ field: "amount", operator: "gt", value: "40" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "amount", operator: "lt", value: "40" }, baseTx)).toBe(false);
    expect(ruleMatches({ field: "amount", operator: "gte", value: "89.99" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "amount", operator: "lte", value: "89.99" }, baseTx)).toBe(true);
  });

  it("matches category eq", () => {
    expect(ruleMatches({ field: "category", operator: "eq", value: "Shopping" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "category", operator: "eq", value: "Dining" }, baseTx)).toBe(false);
  });

  it("matches label contains", () => {
    expect(ruleMatches({ field: "label", operator: "contains", value: "impulse" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "label", operator: "contains", value: "recurring" }, baseTx)).toBe(false);
  });

  it("matches regex", () => {
    expect(ruleMatches({ field: "merchant", operator: "regex", value: "^Ama" }, baseTx)).toBe(true);
    expect(ruleMatches({ field: "merchant", operator: "regex", value: "zon$" }, baseTx)).toBe(true);
  });

  it("rejects invalid regex gracefully", () => {
    expect(ruleMatches({ field: "merchant", operator: "regex", value: "(" }, baseTx)).toBe(false);
  });

  it("scopes by categoryId — rejects when rule category != tx category", () => {
    const rule = { field: "amount", operator: "gt", value: "40", categoryId: 2 }; // Dining
    expect(ruleMatches(rule, baseTx)).toBe(false); // tx is Shopping (6)
  });

  it("scopes by categoryId — allows when rule category == tx category", () => {
    const rule = { field: "amount", operator: "gt", value: "40", categoryId: 6 }; // Shopping
    expect(ruleMatches(rule, baseTx)).toBe(true);
  });

  it("ignores categoryId when not set", () => {
    const rule = { field: "amount", operator: "gt", value: "40" };
    expect(ruleMatches(rule, baseTx)).toBe(true);
  });

  it("returns false for unknown field", () => {
    expect(ruleMatches({ field: "bogus", operator: "contains", value: "x" }, baseTx)).toBe(false);
  });

  it("returns false for unknown operator", () => {
    expect(ruleMatches({ field: "merchant", operator: "bogus", value: "x" }, baseTx)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { matchSavings, type PlatformRow } from "@/lib/savings";

const platform = (over: Partial<PlatformRow> & { id: number; name: string; category: string; matchTags: string }): PlatformRow => ({
  id: over.id,
  name: over.name,
  category: over.category,
  url: over.url ?? "https://example.com",
  description: over.description ?? "",
  matchTags: over.matchTags,
});

describe("matchSavings", () => {
  it("recommends a platform whose matchTags overlap with the user's categories", () => {
    const spend = new Map([["Dining", 120], ["Shopping", 300]]);
    const platforms = [
      platform({ id: 1, name: "Rakuten", category: "cashback", matchTags: "Dining,Shopping,Travel" }),
      platform({ id: 2, name: "YNAB", category: "budgeting", matchTags: "Groceries,Dining,Shopping" }),
    ];
    const out = matchSavings(platforms, spend);
    expect(out.find((r) => r.name === "Rakuten")).toBeTruthy();
    expect(out.find((r) => r.name === "YNAB")).toBeTruthy();
  });

  it("ranks by spend in matched categories (Rakuten over YNAB here)", () => {
    const spend = new Map([["Dining", 120], ["Shopping", 300], ["Groceries", 50]]);
    const platforms = [
      platform({ id: 1, name: "Rakuten", category: "cashback", matchTags: "Dining,Shopping,Travel" }),
      platform({ id: 2, name: "YNAB", category: "budgeting", matchTags: "Groceries,Dining,Shopping" }),
    ];
    const out = matchSavings(platforms, spend);
    // Rakuten relevance = Dining(120) + Shopping(300) = 420; YNAB = Groceries(50) + Dining(120) + Shopping(300) = 470
    // YNAB ranks higher
    expect(out[0].name).toBe("YNAB");
    expect(out[1].name).toBe("Rakuten");
  });

  it("excludes platforms with no overlapping matchTags", () => {
    const spend = new Map([["Dining", 120]]);
    const platforms = [
      platform({ id: 1, name: "Rakuten", category: "cashback", matchTags: "Dining,Shopping,Travel" }),
      platform({ id: 2, name: "GasBuddy", category: "cashback", matchTags: "Transport" }),
    ];
    const out = matchSavings(platforms, spend);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Rakuten");
  });

  it("returns empty when no platforms match", () => {
    const spend = new Map([["Health", 200]]);
    const platforms = [
      platform({ id: 1, name: "Rakuten", category: "cashback", matchTags: "Dining,Shopping,Travel" }),
    ];
    const out = matchSavings(platforms, spend);
    expect(out).toHaveLength(0);
  });
});

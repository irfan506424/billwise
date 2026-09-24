import { prisma } from "./prisma";

export type SavingsRecommendation = {
  platformId: number;
  name: string;
  category: string;
  url: string;
  description: string;
  reason: string;
};

export type CategorySpend = { name: string; spend: number };

export type PlatformRow = { id: number; name: string; category: string; url: string; description: string; matchTags: string };

/** Pure matching — no DB, no AI. Exported for testing. */
export function matchSavings(platforms: PlatformRow[], spendByCategory: Map<string, number>): SavingsRecommendation[] {
  // lowercase spend keys so they match lowercased matchTags
  const spend = new Map<string, number>();
  for (const [k, v] of spendByCategory) spend.set(k.toLowerCase(), v);

  const out: SavingsRecommendation[] = [];
  for (const p of platforms) {
    const tags = p.matchTags.split(",").map((t) => t.trim().toLowerCase());
    const matched = tags.filter((tag) => spend.has(tag));
    if (matched.length === 0) continue;
    const relevance = matched.reduce((s, tag) => s + (spend.get(tag) ?? 0), 0);
    out.push({
      platformId: p.id,
      name: p.name,
      category: p.category,
      url: p.url,
      description: p.description,
      reason: `You spend ${formatCurrency(relevance)} on ${matched.join(", ")} — ${p.name} can save on that.`,
    });
  }
  // rank by relevance (highest spend in matched categories first)
  return out.sort((a, b) => parseCurrencyToNumber(b.reason) - parseCurrencyToNumber(a.reason));
}

/**
 * Recommend savings platforms matched to the user's spending categories.
 * Pure category matching — no AI cost.
 */
export async function recommendSavings(userId: string): Promise<SavingsRecommendation[]> {
  const [platforms, txs] = await Promise.all([
    prisma.savingsPlatform.findMany(),
    prisma.transaction.findMany({
      where: { userId, type: "expense" },
      include: { category: true },
    }),
  ]);

  const spendByCategory = new Map<string, number>();
  for (const t of txs) {
    const name = t.category?.name ?? "Uncategorized";
    spendByCategory.set(name, (spendByCategory.get(name) ?? 0) + Number(t.amount));
  }

  return matchSavings(platforms, spendByCategory);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// extracts the first $X.XX from a reason string for ranking
function parseCurrencyToNumber(reason: string): number {
  const m = reason.match(/\$([0-9.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

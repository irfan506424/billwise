import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type EvalTransaction = {
  merchant: string;
  description: string | null;
  amount: Prisma.Decimal;
  categoryId: number | null;
  categoryName: string | null;
  labelNames: string[];
};

function asNumber(v: string): number {
  return parseFloat(v);
}

export function ruleMatches(
  rule: { field: string; operator: string; value: string; categoryId?: number | null },
  tx: EvalTransaction,
): boolean {
  // If the rule is scoped to a category, the transaction must be in that category.
  if (rule.categoryId != null && rule.categoryId !== tx.categoryId) return false;

  let target: string | number | string[] | null;
  switch (rule.field) {
    case "merchant": target = tx.merchant; break;
    case "description": target = tx.description ?? ""; break;
    case "amount": target = parseFloat(tx.amount.toString()); break;
    case "category": target = tx.categoryName ?? ""; break;
    case "label": target = tx.labelNames; break;
    default: return false;
  }

  switch (rule.operator) {
    case "contains":
      if (Array.isArray(target)) return target.some((t) => t.toLowerCase().includes(rule.value.toLowerCase()));
      if (typeof target === "number") return false;
      return String(target).toLowerCase().includes(rule.value.toLowerCase());
    case "eq":
      if (typeof target === "number") return target === asNumber(rule.value);
      if (Array.isArray(target)) return target.includes(rule.value);
      return String(target).toLowerCase() === rule.value.toLowerCase();
    case "gt":
      return typeof target === "number" && target > asNumber(rule.value);
    case "lt":
      return typeof target === "number" && target < asNumber(rule.value);
    case "gte":
      return typeof target === "number" && target >= asNumber(rule.value);
    case "lte":
      return typeof target === "number" && target <= asNumber(rule.value);
    case "regex":
      try {
        const re = new RegExp(rule.value, "i");
        if (Array.isArray(target)) return target.some((t) => re.test(t));
        return re.test(String(target));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** Evaluate the user's enabled rules against a transaction and persist flags. */
export async function applyRulesToTransaction(txId: number, userId: string, ctx: EvalTransaction) {
  const rules = await prisma.rule.findMany({ where: { enabled: true, userId } });
  const matched = rules.filter((r) => ruleMatches(r, ctx));
  if (matched.length === 0) return [];
  await prisma.flag.createMany({
    data: matched.map((r) => ({
      transactionId: txId,
      ruleId: r.id,
      reason: r.message,
      severity: r.action === "flag_savings" ? "warning" : "info",
    })),
  });
  return matched;
}

/** Re-evaluate all of a user's rules against all of their transactions. */
export async function recomputeAllFlags(userId: string) {
  const [rules, txs] = await Promise.all([
    prisma.rule.findMany({ where: { enabled: true, userId } }),
    prisma.transaction.findMany({ where: { userId }, include: { category: true, labels: true } }),
  ]);
  await prisma.flag.deleteMany({
    where: { transaction: { userId } },
  });

  const flags: { transactionId: number; ruleId: number; reason: string; severity: string }[] = [];
  for (const tx of txs) {
    const ctx: EvalTransaction = {
      merchant: tx.merchant,
      description: tx.description,
      amount: tx.amount,
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? null,
      labelNames: tx.labels.map((l) => l.name),
    };
    for (const r of rules) {
      if (ruleMatches(r, ctx)) {
        flags.push({
          transactionId: tx.id,
          ruleId: r.id,
          reason: r.message,
          severity: r.action === "flag_savings" ? "warning" : "info",
        });
      }
    }
  }
  if (flags.length) await prisma.flag.createMany({ data: flags });
  return { evaluated: txs.length, flagged: flags.length };
}

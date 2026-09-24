import { prisma } from "./prisma";
import { callAI, resolveAIConfig } from "./ai";
import { toDecimal } from "./format";
import { logger } from "./logger";

export type HiddenFeeType =
  | "subscription_creep"
  | "maintenance_fee"
  | "interest"
  | "late_fee"
  | "foreign_fee"
  | "unknown_recurring";

export type DetectedFee = {
  transactionId: number;
  merchant: string;
  type: HiddenFeeType;
  reason: string;
  estimatedMonthly: number | null;
};

export type TxRow = {
  id: number;
  merchant: string;
  amount: number; // caller converts Decimal
  type: string;
  date: string; // ISO
};

const FEE_KEYWORDS = ["fee", "interest", "service", "maintenance", "charge", "late", "apr", "finance", "penalty", "overdraft", "foreign", "fx"];

function matchesFeeKeyword(merchant: string, k: string): boolean {
  // word-boundary match so "coffee" doesn't match "fee"
  return new RegExp(`\\b${k}\\b`, "i").test(merchant);
}

function feeType(merchant: string): HiddenFeeType {
  if (matchesFeeKeyword(merchant, "interest") || matchesFeeKeyword(merchant, "apr") || matchesFeeKeyword(merchant, "finance")) return "interest";
  if (matchesFeeKeyword(merchant, "late") || matchesFeeKeyword(merchant, "penalty")) return "late_fee";
  if (matchesFeeKeyword(merchant, "foreign") || matchesFeeKeyword(merchant, "fx")) return "foreign_fee";
  return "maintenance_fee";
}

/** Pure heuristics — flag sneaky charges without any AI. */
export function detectHeuristics(txs: TxRow[]): DetectedFee[] {
  const byMerchant = new Map<string, TxRow[]>();
  for (const t of txs) {
    const key = t.merchant.toLowerCase();
    const arr = byMerchant.get(key) ?? [];
    arr.push(t);
    byMerchant.set(key, arr);
  }

  const out: DetectedFee[] = [];

  for (const [merchant, rows] of byMerchant) {
    // 1. Fee-keyword merchant: flag EACH tx in the group (so the user can review every one).
    if (FEE_KEYWORDS.some((k) => matchesFeeKeyword(merchant, k))) {
      for (const r of rows) {
        out.push({
          transactionId: r.id,
          merchant,
          type: feeType(merchant),
          reason: `"${merchant}" looks like a recurring fee/charge`,
          estimatedMonthly: avgMonthly(rows),
        });
      }
    }

    // 2. Recurring small charge: same merchant, similar amount (within $1), ≥3 times → subscription creep.
    const recurring = findRecurring(rows);
    if (recurring) {
      out.push({
        transactionId: recurring.sampleId,
        merchant,
        type: "subscription_creep",
        reason: `Recurring ${formatCurrency(recurring.amount)} to ${merchant} for ${recurring.count} months — you may have forgotten this subscription`,
        estimatedMonthly: recurring.amount,
      });
    }
  }

  // dedupe by transactionId (a tx can match both heuristics)
  const seen = new Map<number, DetectedFee>();
  for (const d of out) {
    if (!seen.has(d.transactionId)) {
      seen.set(d.transactionId, d);
    } else {
      const prev = seen.get(d.transactionId)!;
      const newEst = d.estimatedMonthly ?? 0;
      const prevEst = prev.estimatedMonthly ?? 0;
      if (newEst > prevEst) seen.set(d.transactionId, d);
    }
  }
  return [...seen.values()];
}

type RecurringHit = { sampleId: number; amount: number; count: number };
function findRecurring(rows: TxRow[]): RecurringHit | null {
  if (rows.length < 3) return null;
  const byAmount = new Map<number, TxRow[]>();
  for (const r of rows) {
    const band = Math.round(Number(r.amount));
    const arr = byAmount.get(band) ?? [];
    arr.push(r);
    byAmount.set(band, arr);
  }
  for (const [, group] of byAmount) {
    if (group.length >= 3) {
      return { sampleId: group[0].id, amount: avgMonthly(group), count: group.length };
    }
  }
  return null;
}

function avgMonthly(rows: TxRow[]): number {
  const sum = rows.reduce((s, r) => s + Number(r.amount), 0);
  const avg = sum / rows.length;
  return Math.round(avg * 100) / 100;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/** AI pass — finds hidden/sneaky recurring charges the heuristics miss. */
export async function detectWithAI(userId: string, txs: TxRow[]): Promise<DetectedFee[]> {
  const config = await resolveAIConfig(userId);
  if (!config) return []; // AI optional; heuristics already ran
  const summary = txs
    .map((t) => `${t.date.slice(0, 10)} ${t.merchant} ${t.type} ${Number(t.amount)}`)
    .join("\n");
  const prompt = `You are a hidden-fee detector. Review these transactions and find sneaky recurring charges the user likely doesn't notice — forgotten subscriptions, small monthly fees, price creep, duplicate charges, trailing interest/finance charges.
Return ONLY valid JSON: {"fees":[{"merchant":string,"type":"subscription_creep"|"maintenance_fee"|"interest"|"late_fee"|"foreign_fee"|"unknown_recurring","reason":string,"estimatedMonthly":number|null,"transactionId":number}]}.
Cite merchant names and amounts. If nothing suspicious, return an empty fees array.`;
  try {
    const out = await callAI(config, [{ role: "user", content: `${prompt}\n\n--- TRANSACTIONS ---\n${summary}` }], 2048);
    const parsed = extractFeesJson(out) as { fees?: DetectedFee[] };
    return Array.isArray(parsed?.fees) ? parsed.fees : [];
  } catch (e) {
    logger.warn({ event: "hiddenfees.ai.error", message: (e as Error).message });
    return [];
  }
}

function extractFeesJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Full detection: heuristics + AI pass, deduped, persisted as HiddenFee rows. */
export async function detectHiddenFees(userId: string): Promise<{ added: number; total: number }> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
  const rows: TxRow[] = txs.map((t) => ({
    id: t.id,
    merchant: t.merchant,
    amount: Number(t.amount),
    type: t.type,
    date: t.date.toISOString(),
  }));

  const heuristic = detectHeuristics(rows);
  const ai = await detectWithAI(userId, rows);
  const all = [...heuristic, ...ai];
  const seen = new Map<number, DetectedFee>();
  for (const d of all) {
    if (!seen.has(d.transactionId)) seen.set(d.transactionId, d);
    else {
      const prev = seen.get(d.transactionId)!;
      if ((d.estimatedMonthly ?? 0) > (prev.estimatedMonthly ?? 0)) seen.set(d.transactionId, d);
    }
  }

  let added = 0;
  for (const d of seen.values()) {
    const existing = await prisma.hiddenFee.findUnique({
      where: { userId_transactionId: { userId, transactionId: d.transactionId } },
    });
    if (existing) {
      // update reason/estimate if the new one is richer
      await prisma.hiddenFee.update({
        where: { id: existing.id },
        data: {
          type: d.type,
          reason: d.reason,
          estimatedMonthly: d.estimatedMonthly ?? null,
          dismissed: false,
        },
      });
    } else {
      await prisma.hiddenFee.create({
        data: {
          userId,
          transactionId: d.transactionId,
          type: d.type,
          merchant: d.merchant,
          reason: d.reason,
          estimatedMonthly: d.estimatedMonthly ?? null,
        },
      });
      added++;
    }
  }
  logger.info({ event: "hiddenfees.detected", userId, added, total: seen.size });
  return { added, total: seen.size };
}

/** Detect for all users (for the scheduled job). */
export async function detectAllUsers(): Promise<{ users: number; added: number }> {
  const users = await prisma.user.findMany({ where: { NOT: { transactions: { none: {} } } }, select: { id: true } });
  let added = 0;
  for (const u of users) {
    try {
      const r = await detectHiddenFees(u.id);
      added += r.added;
    } catch (e) {
      logger.error({ event: "hiddenfees.cron.error", userId: u.id, message: (e as Error).message });
    }
  }
  return { users: users.length, added };
}

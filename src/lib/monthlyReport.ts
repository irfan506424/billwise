import { prisma } from "./prisma";
import { callAI, resolveAIConfig } from "./ai";
import { logger } from "./logger";

export type MonthlyReport = {
  id: number;
  month: string;
  headline: string;
  risks: string;
  recommendations: string;
  createdAt: string;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const COACHING_PROMPT = `You are a personal finance coach reviewing a user's transactions for the past month.
Give a proactive monthly digest that helps the user stay financially safe and manage spending.
Return ONLY valid JSON:
{
  "headline": string,
  "risks": [string],
  "recommendations": [string]
}
- headline: one short sentence summarizing their financial month (e.g., "You're on track but dining is creeping up").
- risks: 2-5 specific risks you see (hidden fees, overspending, budget overruns, subscription creep, unusual merchants) — each one short line.
- recommendations: 2-5 concrete actions to stay safe and manage spending this month — each one short line.
If nothing notable, return empty risks and a calm headline.`;

/**
 * Generate (or refresh) this user's monthly financial-safety report.
 * Runs the AI review with a coaching prompt and persists a MonthlyReport.
 */
export async function generateMonthlyReport(userId: string): Promise<MonthlyReport | null> {
  const config = await resolveAIConfig(userId);
  if (!config) {
    logger.warn({ event: "monthlyReport.no_ai", userId });
    return null;
  }

  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 300,
  });
  if (txs.length === 0) return null;

  const summary = txs
    .map((t) => `${t.date.toISOString().slice(0, 10)} ${t.merchant} ${t.type} ${Number(t.amount)}`)
    .join("\n");

  let parsed: { headline?: string; risks?: string[]; recommendations?: string[] };
  try {
    const out = await callAI(config, [{ role: "user", content: `${COACHING_PROMPT}\n\n--- TRANSACTIONS (last ${txs.length}) ---\n${summary}` }], 2048);
    parsed = extractJson(out) as typeof parsed;
  } catch (e) {
    logger.error({ event: "monthlyReport.ai_error", userId, message: (e as Error).message });
    return null;
  }

  const month = currentMonth();
  const data = {
    userId,
    month,
    headline: parsed.headline ?? "No issues found this month.",
    risks: JSON.stringify(parsed.risks ?? []),
    recommendations: JSON.stringify(parsed.recommendations ?? []),
  };

  // upsert — one report per user per month
  const existing = await prisma.monthlyReport.findUnique({
    where: { userId_month: { userId, month } },
  });
  let row;
  if (existing) {
    row = await prisma.monthlyReport.update({ where: { id: existing.id }, data });
  } else {
    row = await prisma.monthlyReport.create({ data });
  }

  logger.info({ event: "monthlyReport.generated", userId, month });
  return {
    id: row.id,
    month: row.month,
    headline: row.headline,
    risks: row.risks,
    recommendations: row.recommendations,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Fetch the latest report for a user (or null). */
export async function getLatestMonthlyReport(userId: string): Promise<MonthlyReport | null> {
  const row = await prisma.monthlyReport.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    headline: row.headline,
    risks: row.risks,
    recommendations: row.recommendations,
    createdAt: row.createdAt.toISOString(),
  };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

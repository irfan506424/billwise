import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMonthlyReport } from "@/lib/monthlyReport";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

// Generate/refresh a monthly report for every user with transactions.
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { NOT: { transactions: { none: {} } } },
    select: { id: true },
  });
  let generated = 0;
  for (const u of users) {
    try {
      const r = await generateMonthlyReport(u.id);
      if (r) generated++;
    } catch (e) {
      logger.error({ event: "monthlyReport.cron.error", userId: u.id, message: (e as Error).message });
    }
  }
  logger.info({ event: "cron.monthlyReport.done", users: users.length, generated });
  return NextResponse.json({ users: users.length, generated });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

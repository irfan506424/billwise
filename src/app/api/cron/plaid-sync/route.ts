import { NextRequest, NextResponse } from "next/server";
import { syncAllUsers, plaidAvailable } from "@/lib/plaid";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Vercel Cron invokes this with `Authorization: Bearer <CRON_SECRET>`.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!plaidAvailable()) return NextResponse.json({ ok: true, skipped: "plaid not configured" });

  const { users, results } = await syncAllUsers();
  const totals = results.reduce(
    (acc, r) => ({ added: acc.added + r.added, modified: acc.modified + r.modified, removed: acc.removed + r.removed }),
    { added: 0, modified: 0, removed: 0 },
  );
  logger.info({ event: "plaid.cron.done", users, ...totals });
  return NextResponse.json({ users, ...totals });
}

// Vercel Cron sends GET as well in some configs.
export async function GET(request: NextRequest) {
  return POST(request);
}

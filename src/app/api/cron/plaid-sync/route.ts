import { NextRequest, NextResponse } from "next/server";
import { syncAllUsers, plaidAvailable } from "@/lib/plaid";
import { syncAllUsersStripe, stripeAvailable } from "@/lib/stripe";
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

  const summary: Record<string, unknown> = {};

  if (plaidAvailable()) {
    const { users, results } = await syncAllUsers();
    summary.plaid = {
      users,
      added: results.reduce((a, r) => a + r.added, 0),
      modified: results.reduce((a, r) => a + r.modified, 0),
      removed: results.reduce((a, r) => a + r.removed, 0),
    };
  }

  if (stripeAvailable()) {
    const { users: sUsers, added } = await syncAllUsersStripe();
    summary.stripe = { users: sUsers, added };
  }

  logger.info({ event: "cron.done", ...summary });
  return NextResponse.json(summary);
}

// Vercel Cron sends GET as well in some configs.
export async function GET(request: NextRequest) {
  return POST(request);
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { shouldSyncWebhook, syncByItemId, plaidAvailable } from "@/lib/plaid";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  webhook_type: z.string().optional(),
  webhook_code: z.string(),
  item_id: z.string(),
});

// Auth: a shared secret in the query string (configured in the Plaid dashboard
// webhook URL). For production-grade verification, validate Plaid's signed JWT
// (Plaid-Verification header) against their JWKS instead.
function authorized(request: NextRequest): boolean {
  const secret = process.env.PLAID_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!plaidAvailable()) return NextResponse.json({ error: "Plaid not configured." }, { status: 400 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  const { webhook_code, item_id } = parsed.data;

  logger.info({ event: "plaid.webhook", code: webhook_code, itemId: item_id });

  if (!shouldSyncWebhook(webhook_code)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Confirm the item belongs to a user (and isn't stale).
  const item = await prisma.plaidItem.findUnique({ where: { itemId: item_id } });
  if (!item) return NextResponse.json({ ok: true, skipped: true });

  try {
    await syncByItemId(item_id);
  } catch (err) {
    logger.error({ event: "plaid.webhook.sync.error", itemId: item_id, message: (err as Error).message });
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

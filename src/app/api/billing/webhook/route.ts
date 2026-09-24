import { NextRequest, NextResponse } from "next/server";
import { billingAvailable, handleBillingWebhook } from "@/lib/billing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Stripe signed webhooks — no session. Verify the Stripe-Signature header.
export async function POST(request: NextRequest) {
  if (!billingAvailable()) return NextResponse.json({ error: "Stripe not configured." }, { status: 400 });
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  try {
    await handleBillingWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (e) {
    logger.error({ event: "billing.webhook.error", message: (e as Error).message });
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}

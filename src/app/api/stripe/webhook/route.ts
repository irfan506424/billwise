import { NextRequest, NextResponse } from "next/server";
import { stripeAvailable } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Stripe Connect webhooks (optional). Shared-secret auth via ?secret=.
// Verify the Stripe-Signature header against STRIPE_WEBHOOK_SECRET in production.
function authorized(request: NextRequest): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;
  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!stripeAvailable()) return NextResponse.json({ error: "Stripe not configured." }, { status: 400 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.text();
  logger.info({ event: "stripe.webhook", bodyPreview: body.slice(0, 200) });
  // A real handler would verify the Stripe-Signature header and process the event
  // (e.g. charge.succeeded → sync that account). Cron is the primary sync path here.
  return NextResponse.json({ received: true });
}

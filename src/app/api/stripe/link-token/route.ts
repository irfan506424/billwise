import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createConnectLink, stripeConnectAvailable } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripeConnectAvailable()) {
    return NextResponse.json(
      { error: "Stripe not configured. Set STRIPE_CONNECT_CLIENT_ID and STRIPE_SECRET_KEY (get them at https://dashboard.stripe.com/connect → OAuth)." },
      { status: 400 },
    );
  }
  const redirectUri = `${request.nextUrl.origin}/api/stripe/callback`;
  const url = createConnectLink(userId, redirectUri);
  return NextResponse.json({ url });
}

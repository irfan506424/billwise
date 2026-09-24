import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { exchangeAuthorizationCode, stripeConnectAvailable, syncStripeAccount } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Stripe redirects the user's browser here with ?code=... after OAuth.
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(new URL("/login?error=session", request.nextUrl));
  if (!stripeConnectAvailable()) return NextResponse.redirect(new URL("/accounts?error=stripe_not_configured", request.nextUrl));

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/accounts?error=no_code", request.nextUrl));

  try {
    const { accountId } = await exchangeAuthorizationCode(userId, code);
    const account = await prisma.stripeAccount.findFirst({ where: { userId, accountId } });
    if (account) await syncStripeAccount(account);
    await audit(userId, "stripe.connect", { targetType: "stripe_account", targetId: accountId });
  } catch (e) {
    return NextResponse.redirect(new URL(`/accounts?error=${encodeURIComponent((e as Error).message)}`, request.nextUrl));
  }
  return NextResponse.redirect(new URL("/accounts?connected=stripe", request.nextUrl));
}

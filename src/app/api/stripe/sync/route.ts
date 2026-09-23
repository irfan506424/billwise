import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { syncAllStripeAccounts, stripeAvailable } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripeAvailable()) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 400 });
  }
  const results = await syncAllStripeAccounts(userId);
  const totals = results.reduce((acc, r) => ({ added: acc.added + r.added }), { added: 0 });
  return NextResponse.json({ results, totals });
}

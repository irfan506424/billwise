import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createLinkToken, plaidAvailable } from "@/lib/plaid";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!plaidAvailable()) {
    return NextResponse.json(
      { error: "Plaid not configured. Set PLAID_CLIENT_ID and PLAID_SECRET (sandbox keys are free at plaid.com)." },
      { status: 400 },
    );
  }
  const linkToken = await createLinkToken(userId);
  return NextResponse.json({ link_token: linkToken });
}

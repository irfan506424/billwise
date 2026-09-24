import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { createPortalSession, billingAvailable } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!billingAvailable()) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 400 });
  }
  try {
    const url = await createPortalSession(userId);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

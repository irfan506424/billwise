import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, billingAvailable, type Plan } from "@/lib/billing";
import { parseBody } from "@/lib/validation";

const schema = z.object({ plan: z.enum(["pro", "enterprise"]) });

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!billingAvailable()) {
    return NextResponse.json({ error: "Stripe not configured. Set STRIPE_SECRET_KEY and a price ID env var." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const url = await createCheckoutSession(userId, user?.email ?? "", parsed.value.plan as Plan);
  return NextResponse.json({ url });
}

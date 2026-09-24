import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPayment, paymentsAvailable } from "@/lib/payments";
import { parseBody } from "@/lib/validation";

const schema = z.object({
  toUserId: z.string().min(1),
  amount: z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a number" });
      return z.NEVER;
    }
    return n;
  }).refine((n) => n > 0, "must be a positive number"),
  currency: z.string().trim().max(8).default("USD"),
  note: z.string().max(500).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!paymentsAvailable()) {
    return NextResponse.json(
      { error: "Payments not configured. Set STRIPE_SECRET_KEY and connect Stripe accounts under Banks." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  // Recipient must exist and have a linked Stripe account.
  const recipient = await prisma.user.findUnique({ where: { id: v.toUserId } });
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  try {
    const result = await sendPayment(userId, v.toUserId, v.amount, v.currency, v.note);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

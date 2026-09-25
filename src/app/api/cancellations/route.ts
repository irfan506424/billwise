import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestCancellation } from "@/lib/cancellations";
import { parseBody } from "@/lib/validation";

const schema = z.object({
  hiddenFeeId: z.number().int().positive(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });

  const hiddenFee = await prisma.hiddenFee.findUnique({
    where: { userId_transactionId: { userId, transactionId: parsed.value.hiddenFeeId } },
  });
  if (!hiddenFee || hiddenFee.userId !== userId) {
    return NextResponse.json({ error: "Hidden fee not found" }, { status: 404 });
  }

  const result = await requestCancellation(userId, {
    id: hiddenFee.id,
    merchant: hiddenFee.merchant,
    estimatedMonthly: Number(hiddenFee.estimatedMonthly ?? 0),
    transactionId: hiddenFee.transactionId,
  });
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}

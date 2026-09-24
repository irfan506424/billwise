import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { exchangePublicToken, plaidAvailable, syncItem } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validation";
import { audit } from "@/lib/audit";

const exchangeSchema = z.object({
  public_token: z.string().min(1),
  institution_name: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!plaidAvailable()) {
    return NextResponse.json({ error: "Plaid not configured." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(exchangeSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  const result = await exchangePublicToken(userId, v.public_token, v.institution_name);
  await audit(userId, "plaid.connect", { targetType: "plaid_item", targetId: result.itemId });

  // Pull initial transactions right away.
  const item = await prisma.plaidItem.findUnique({ where: { itemId: result.itemId } });
  if (item) {
    try {
      await syncItem(item);
    } catch (e) {
      // initial sync can lag in sandbox; not fatal — user can hit Sync later
      console.error("initial plaid sync failed:", (e as Error).message);
    }
  }

  return NextResponse.json({ ok: true, itemId: result.itemId }, { status: 201 });
}

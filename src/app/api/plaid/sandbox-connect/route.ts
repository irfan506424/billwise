import { NextResponse } from "next/server";
import { Products } from "plaid";
import { getUserId } from "@/lib/auth";
import { getPlaidClient, exchangePublicToken, syncItem, plaidAvailable } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Sandbox-only convenience: create a test item without the Plaid Link popup.
// Useful when the Plaid CDN is blocked (e.g. corporate proxy) or for CI/smoke
// tests. Disabled outside sandbox.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!plaidAvailable()) return NextResponse.json({ error: "Plaid not configured." }, { status: 400 });
  if (process.env.PLAID_ENV && process.env.PLAID_ENV !== "sandbox") {
    return NextResponse.json({ error: "Sandbox-only endpoint." }, { status: 400 });
  }

  const client = getPlaidClient();
  const pt = await client.sandboxPublicTokenCreate({
    institution_id: "ins_109508",
    initial_products: [Products.Transactions],
  });

  const { itemId } = await exchangePublicToken(userId, pt.data.public_token, "Sandbox Test Bank");
  const item = await prisma.plaidItem.findUnique({ where: { itemId } });
  let sync = { added: 0, modified: 0, removed: 0 };
  if (item) {
    // Plaid sandbox generates transaction data asynchronously — an instant
    // sync can come back empty. Retry a couple of times to capture it.
    for (let attempt = 0; attempt < 3 && sync.added === 0; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
        const r = await syncItem(item);
        sync = { added: r.added, modified: r.modified, removed: r.removed };
      } catch (e) {
        console.error("sandbox sync attempt failed:", (e as Error).message);
      }
    }
  }
  return NextResponse.json({ ok: true, itemId, ...sync }, { status: 201 });
}

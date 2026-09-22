import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { syncAllItems, plaidAvailable } from "@/lib/plaid";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!plaidAvailable()) {
    return NextResponse.json({ error: "Plaid not configured." }, { status: 400 });
  }
  const results = await syncAllItems(userId);
  const totals = results.reduce(
    (acc, r) => ({ added: acc.added + r.added, modified: acc.modified + r.modified, removed: acc.removed + r.removed }),
    { added: 0, modified: 0, removed: 0 },
  );
  return NextResponse.json({ results, totals });
}

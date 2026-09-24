import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { deleteUser } from "@/lib/accountData";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Audit BEFORE deleting (can't audit a deleted user).
  await audit(userId, "user.account_deleted");
  await deleteUser(userId);
  return NextResponse.json({ ok: true });
}

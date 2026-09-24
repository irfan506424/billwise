import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { detectHiddenFees } from "@/lib/hiddenFees";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await detectHiddenFees(userId);
  return NextResponse.json(result);
}

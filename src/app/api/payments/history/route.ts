import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { listUserPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listUserPayments(userId);
  return NextResponse.json(rows);
}

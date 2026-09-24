import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getUserPlan } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await getUserPlan(userId);
  return NextResponse.json({ plan });
}

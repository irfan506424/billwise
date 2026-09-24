import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { recommendSavings } from "@/lib/savings";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const recommendations = await recommendSavings(userId);
  return NextResponse.json(recommendations);
}

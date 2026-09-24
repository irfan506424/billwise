import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getLatestMonthlyReport } from "@/lib/monthlyReport";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await getLatestMonthlyReport(userId);
  return NextResponse.json(report);
}

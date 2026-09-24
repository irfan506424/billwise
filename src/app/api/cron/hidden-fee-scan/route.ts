import { NextRequest, NextResponse } from "next/server";
import { detectAllUsers } from "@/lib/hiddenFees";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await detectAllUsers();
  logger.info({ event: "cron.hiddenfees.done", ...result });
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return POST(request);
}

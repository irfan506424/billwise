import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { recomputeAllFlags } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await recomputeAllFlags(userId);
  return NextResponse.json(result);
}

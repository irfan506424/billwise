import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { gatherUserExport } from "@/lib/accountData";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await gatherUserExport(userId);
  await audit(userId, "user.data_exported");
  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { parseBody } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  provider: z.enum(["anthropic", "openai", "openrouter", "ollama"]),
  apiKey: z.string().min(1).max(200),
  baseUrl: z.string().max(200).optional(),
  model: z.string().min(1).max(100),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiProvider: true, aiBaseUrl: true, aiModel: true, aiApiKey: true },
  });
  return NextResponse.json({
    provider: user?.aiProvider ?? null,
    baseUrl: user?.aiBaseUrl ?? null,
    model: user?.aiModel ?? null,
    hasKey: !!user?.aiApiKey,
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiProvider: v.provider,
      aiApiKey: encrypt(v.apiKey),
      aiBaseUrl: v.baseUrl ?? null,
      aiModel: v.model,
    },
  });
  await audit(userId, "user.ai_settings_updated", { targetType: "user", meta: { provider: v.provider } });
  return NextResponse.json({ ok: true });
}

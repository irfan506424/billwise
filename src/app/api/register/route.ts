import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, parseBody } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { randomBytes } from "node:crypto";

function generateInboundAlias(): string {
  return `${randomBytes(6).toString("hex")}@inbound.billwise.app`;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!(await rateLimit(`register:${ip}`, { windowMs: 60_000, max: 5 }))) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = parseBody(registerSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const { email, password, name } = parsed.value;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, inboundEmail: generateInboundAlias() },
  });
  logger.info({ event: "user.registered", userId: user.id });
  await audit(user.id, "user.registered");
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}

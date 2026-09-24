import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestInboundEmail } from "@/lib/emailInbound";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string().default("(no subject)"),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

function authorized(request: NextRequest): boolean {
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (!secret) return false;
  return request.headers.get("webhook-secret") === secret || request.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  try {
    const result = await ingestInboundEmail(parsed.data);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, transactionId: result.transactionId }, { status: 201 });
  } catch (e) {
    logger.error({ event: "email.inbound.error", message: (e as Error).message });
    return NextResponse.json({ error: "Inbound ingestion failed" }, { status: 500 });
  }
}

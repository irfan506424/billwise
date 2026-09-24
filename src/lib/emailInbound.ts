import { prisma } from "./prisma";
import { extractBillFromImage, extractBillFromText } from "./ai";
import { toDecimal } from "./format";
import { applyRulesToTransaction } from "./rules";
import { logger } from "./logger";

export type InboundAttachment = {
  filename: string;
  contentType: string;
  content: string; // base64
};

export type InboundEmail = {
  from: string;
  to: string; // the user's inboundEmail address
  subject: string;
  text?: string;
  html?: string;
  attachments?: InboundAttachment[];
};

export interface IngestResult {
  ok: boolean;
  transactionId?: number;
  error?: string;
}

/**
 * Handle an inbound email: look up the user by the `to` address,
 * extract a bill/invoice from the attachment (image/pdf) or the
 * text/html body with AI, create a transaction.
 */
export async function ingestInboundEmail(email: InboundEmail): Promise<IngestResult> {
  // 1. Resolve the user from the inbound address.
  const user = await prisma.user.findUnique({ where: { inboundEmail: email.to.toLowerCase() } });
  if (!user) {
    logger.warn({ event: "email.inbound.unknown_recipient", to: email.to });
    return { ok: false, error: "Unknown recipient address — forward to your personal Billwise inbound address." };
  }

  // 2. Pick the best content to extract from: an image/pdf attachment, else the text body.
  let extracted = null;
  try {
    const attachment = email.attachments?.find((a) => /image\/|application\/pdf/.test(a.contentType));
    if (attachment) {
      const mediaType = attachment.contentType === "application/pdf" ? "application/pdf" : "image/png";
      extracted = await extractBillFromImage(user.id, attachment.content, mediaType as "image/png" | "image/jpeg" | "application/pdf");
    } else {
      const text = email.text || stripHtml(email.html || "");
      if (!text) return { ok: false, error: "Nothing to extract from the email." };
      extracted = await extractBillFromText(user.id, text);
    }
  } catch (e) {
    logger.error({ event: "email.inbound.extract_failed", userId: user.id, message: (e as Error).message });
    return { ok: false, error: `AI extraction failed: ${(e as Error).message}` };
  }

  // 3. Persist the transaction.
  const tx = await prisma.transaction.create({
    data: {
      merchant: extracted.merchant || email.from,
      description: email.subject || null,
      amount: toDecimal(extracted.total ?? 0),
      currency: extracted.currency ?? "USD",
      type: extracted.type ?? "expense",
      date: extracted.date ? new Date(extracted.date) : new Date(),
      source: "email",
      rawText: extracted.rawText ?? (email.text || stripHtml(email.html || "")).slice(0, 4000) ?? null,
      lineItems: extracted.lineItems ? JSON.stringify(extracted.lineItems) : null,
      tax: extracted.tax != null ? toDecimal(extracted.tax) : null,
      userId: user.id,
    },
    include: { category: true, labels: true },
  });

  await applyRulesToTransaction(tx.id, user.id, {
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    labelNames: tx.labels.map((l) => l.name),
  });

  logger.info({ event: "email.inbound.ingested", userId: user.id, merchant: tx.merchant });
  return { ok: true, transactionId: tx.id };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

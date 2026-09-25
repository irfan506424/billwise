import { prisma } from "./prisma";
import { logger } from "./logger";
import { audit } from "./audit";

export type CancelStatus = "pending" | "sent" | "confirmed" | "failed";
export type CancelMethod = "email" | "card" | "manual";

export interface CancelRequest {
  hiddenFeeId: number;
  merchant: string;
  emailTo?: string; // merchant billing/cancel address (best guess)
}

const DEFAULT_CANCEL_EMAILS: Record<string, string> = {
  netflix: "cancel@netflix.com",
  spotify: "cancel@spotify.com",
  adobe: "cancel@adobe.com",
  amazon: "cancel@amazon.com",
  google: "cancel@google.com",
  microsoft: "cancel@microsoft.com",
};

function guessCancelEmail(merchant: string): string {
  const key = merchant.toLowerCase().split(/\s+/)[0];
  return DEFAULT_CANCEL_EMAILS[key] || `cancel@${key}.com`;
}

function cancelEmailBody(merchant: string, amount: number): string {
  return `To Whom It May Concern,

I am writing to request the cancellation of my subscription / recurring charge with ${merchant} (recently charged $${amount.toFixed(2)}).

Please cancel this subscription effective immediately and confirm by reply email. Do not charge my account again.

Thank you.`;
}

export interface CancelResult {
  ok: boolean;
  status: CancelStatus;
  method: CancelMethod;
  mailto?: string; // when we couldn't send on the user's behalf — a mailto: link for them to send manually
  error?: string;
}

/**
 * Request a subscription cancellation on the user's behalf.
 * Sends a templated email to the merchant via Resend if RESEND_API_KEY is set;
 * otherwise returns a mailto: link the user can open in their own email client.
 */
export async function requestCancellation(
  userId: string,
  hiddenFee: { id: number; merchant: string; estimatedMonthly: number | null; transactionId: number },
): Promise<CancelResult> {
  const merchant = hiddenFee.merchant;
  const amount = hiddenFee.estimatedMonthly ?? 0;
  const to = guessCancelEmail(merchant);
  const subject = `Cancel subscription with ${merchant}`;
  const body = cancelEmailBody(merchant, amount);

  // If no outbound email service configured, give the user a mailto: link to send themselves.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await prisma.cancellation.create({
      data: {
        userId,
        hiddenFeeId: hiddenFee.id,
        merchant,
        status: "pending",
        method: "email",
      },
    });
    await audit(userId, "cancellation.requested", { targetType: "hidden_fee", targetId: String(hiddenFee.id) });
    return { ok: true, status: "pending", method: "email", mailto };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status}`);

    const row = await prisma.cancellation.create({
      data: { userId, hiddenFeeId: hiddenFee.id, merchant, status: "sent", method: "email", sentAt: new Date() },
    });
    await audit(userId, "cancellation.sent", { targetType: "hidden_fee", targetId: String(hiddenFee.id) });
    logger.info({ event: "cancellation.sent", userId, merchant });
    return { ok: true, status: "sent", method: "email" };
  } catch (e) {
    logger.error({ event: "cancellation.error", userId, merchant, message: (e as Error).message });
    await prisma.cancellation.create({
      data: { userId, hiddenFeeId: hiddenFee.id, merchant, status: "failed", method: "email" },
    });
    return { ok: false, status: "failed", method: "email", error: (e as Error).message };
  }
}

/** Mark a cancellation as confirmed or failed (user followed up). */
export async function updateCancellationStatus(
  userId: string,
  id: number,
  status: Exclude<CancelStatus, "pending" | "sent">,
): Promise<void> {
  const row = await prisma.cancellation.findUnique({ where: { id } });
  if (!row || row.userId !== userId) throw new Error("Not found");
  await prisma.cancellation.update({
    where: { id },
    data: { status, confirmedAt: status === "confirmed" ? new Date() : null },
  });
}

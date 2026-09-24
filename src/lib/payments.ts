import Stripe from "stripe";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { toDecimal } from "./format";
import { logger } from "./logger";
import { audit } from "./audit";

export function paymentsAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Billwise's application fee on a P2P payment (in cents). 0 for MVP; set to a percent in production.
export function appFeeCents(amountCents: number): number {
  return 0;
}

export interface SendResult {
  chargeId: string;
  transferId: string;
}

/**
 * Orchestrate a P2P payment: charge the sender's connected Stripe account
 * and transfer to the recipient's connected account. Returns the
 * Stripe charge + transfer ids. Both users must have linked Stripe accounts.
 */
export async function sendPayment(
  senderUserId: string,
  recipientUserId: string,
  amount: number,
  currency = "USD",
  note?: string,
): Promise<SendResult> {
  const sender = await prisma.stripeAccount.findFirst({ where: { userId: senderUserId } });
  const recipient = await prisma.stripeAccount.findFirst({ where: { userId: recipientUserId } });
  if (!sender) throw new Error("You haven't linked a Stripe account. Connect one under Banks.");
  if (!recipient) throw new Error("The recipient hasn't linked a Stripe account.");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
  });
  const senderToken = decrypt(sender.accessToken).split("::")[0];
  const amountCents = Math.round(amount * 100);

  // 1. Charge the sender's card on their connected account.
  const charge = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: currency.toLowerCase(),
      payment_method_types: ["card"],
      application_fee_amount: appFeeCents(amountCents),
      metadata: { senderUserId, recipientUserId, note: note ?? "" },
    },
    { stripeAccount: senderToken },
  );

  // 2. Transfer the net amount to the recipient's connected account.
  const transfer = await stripe.transfers.create(
    {
      amount: amountCents - appFeeCents(amountCents),
      currency: currency.toLowerCase(),
      destination: recipient.accountId,
      metadata: { senderUserId, recipientUserId, chargeId: charge.id },
    },
    { stripeAccount: senderToken },
  );

  // 3. Record both legs of the payment.
  await prisma.payment.createMany({
    data: [
      {
        userId: senderUserId,
        direction: "sent",
        counterpartyUserId: recipientUserId,
        amount: toDecimal(amount),
        currency,
        stripeChargeId: charge.id,
        stripeTransferId: transfer.id,
        note: note ?? null,
        status: "succeeded",
      },
      {
        userId: recipientUserId,
        direction: "received",
        counterpartyUserId: senderUserId,
        amount: toDecimal(amount),
        currency,
        stripeChargeId: charge.id,
        stripeTransferId: transfer.id,
        note: note ?? null,
        status: "succeeded",
      },
    ],
  });
  await audit(senderUserId, "payment.sent", {
    targetType: "payment",
    meta: { to: recipientUserId, amount },
  });

  logger.info({ event: "payment.sent", senderUserId, recipientUserId, amount });
  return { chargeId: charge.id, transferId: transfer.id };
}

export type PaymentRow = {
  id: number;
  userId: string;
  direction: string;
  counterpartyUserId: string | null;
  amount: string;
  currency: string;
  note: string | null;
  status: string;
  createdAt: string;
};

/** List a user's sent + received payments. */
export async function listUserPayments(userId: string): Promise<PaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    direction: r.direction,
    counterpartyUserId: r.counterpartyUserId,
    amount: String(r.amount),
    currency: r.currency,
    stripeChargeId: r.stripeChargeId,
    stripeTransferId: r.stripeTransferId,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })) as PaymentRow[];
}

import Stripe from "stripe";
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import { toDecimal } from "./format";
import { applyRulesToTransaction } from "./rules";
import { logger } from "./logger";

export function stripeAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** True when Stripe Connect OAuth is configured (for linking a user's Stripe account). */
export function stripeConnectAvailable(): boolean {
  return !!process.env.STRIPE_CONNECT_CLIENT_ID && !!process.env.STRIPE_SECRET_KEY;
}

/** Stripe Connect OAuth authorize URL to send the user to. */
export function createConnectLink(userId: string, redirectUri: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error("STRIPE_CONNECT_CLIENT_ID not set");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    state: userId,
    redirect_uri: redirectUri,
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export interface ExchangeResult {
  accountId: string;
  scope: string;
}

/** Exchange a Stripe Connect authorization code for a (refreshable) access token. */
export async function exchangeAuthorizationCode(
  userId: string,
  code: string,
): Promise<ExchangeResult> {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  const clientSecret = process.env.STRIPE_SECRET_KEY;
  if (!clientId || !clientSecret) throw new Error("STRIPE_CONNECT_CLIENT_ID and STRIPE_SECRET_KEY must be set");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe OAuth exchange failed: ${JSON.stringify(json)}`);

  const { access_token, refresh_token, stripe_user_id, scope } = json as {
    access_token: string;
    refresh_token: string;
    stripe_user_id: string;
    scope: string;
  };

  await prisma.stripeAccount.create({
    data: {
      userId,
      accountId: stripe_user_id,
      accessToken: encrypt(`${access_token}::${refresh_token}`),
      scope: scope || "read_only",
    },
  });

  return { accountId: stripe_user_id, scope: scope || "read_only" };
}

export type StripeChargeLike = Pick<
  Stripe.Charge,
  "id" | "amount" | "currency" | "created" | "description" | "receipt_email"
>;

/** Pure mapping from a Stripe charge to our model fields. Exported for testing. */
export function mapStripeCharge(c: StripeChargeLike) {
  return {
    merchant: c.receipt_email || c.description || "Stripe payment",
    description: c.description ?? null,
    amount: toDecimal(c.amount / 100), // Stripe stores cents
    currency: (c.currency || "usd").toUpperCase(),
    type: "income" as const,
    date: new Date(c.created * 1000), // unix seconds → ms
    source: "stripe",
    externalSource: "stripe",
    externalId: c.id,
  };
}

export interface SyncResult {
  accountId: string;
  added: number;
}

/** Pull a connected Stripe account's charges and upsert them as income transactions. */
export async function syncStripeAccount(account: {
  id: number;
  userId: string;
  accountId: string;
  accessToken: string;
}): Promise<SyncResult> {
  const token = decrypt(account.accessToken).split("::")[0];
  const stripe = new Stripe(token, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
  let added = 0;
  let startingAfter: string | undefined;

  // Paginate charges (payments received).
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    const page = await stripe.charges.list({ limit: 100, starting_after: startingAfter });
    for (const c of page.data) {
      const mapped = mapStripeCharge(c);
      const tx = await prisma.transaction.upsert({
        where: {
          userId_externalSource_externalId: {
            userId: account.userId,
            externalSource: "stripe",
            externalId: mapped.externalId,
          },
        },
        update: {
          merchant: mapped.merchant,
          description: mapped.description,
          amount: mapped.amount,
          currency: mapped.currency,
          date: mapped.date,
        },
        create: { ...mapped, userId: account.userId },
        include: { category: true, labels: true },
      });
      // (re)evaluate rules
      await prisma.flag.deleteMany({ where: { transactionId: tx.id } });
      await applyRulesToTransaction(tx.id, account.userId, {
        merchant: tx.merchant,
        description: tx.description,
        amount: tx.amount,
        categoryId: tx.categoryId,
        categoryName: tx.category?.name ?? null,
        labelNames: tx.labels.map((l) => l.name),
      });
      added++;
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  await prisma.stripeAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date() } });
  logger.info({ event: "stripe.sync", accountId: account.accountId, added });
  return { accountId: account.accountId, added };
}

/** Sync all of a user's connected Stripe accounts. */
export async function syncAllStripeAccounts(userId: string): Promise<SyncResult[]> {
  const accounts = await prisma.stripeAccount.findMany({ where: { userId } });
  const results: SyncResult[] = [];
  for (const a of accounts) {
    try {
      results.push(await syncStripeAccount(a));
    } catch (err) {
      logger.error({ event: "stripe.sync.error", accountId: a.accountId, message: (err as Error).message });
    }
  }
  return results;
}

/** Sync every connected Stripe account across all users (for the scheduled job). */
export async function syncAllUsersStripe(): Promise<{ users: number; added: number }> {
  const accounts = await prisma.stripeAccount.findMany();
  let added = 0;
  const seen = new Set<string>();
  for (const a of accounts) {
    seen.add(a.userId);
    try {
      const r = await syncStripeAccount(a);
      added += r.added;
    } catch (err) {
      logger.error({ event: "stripe.cron.error", userId: a.userId, message: (err as Error).message });
    }
  }
  return { users: seen.size, added };
}

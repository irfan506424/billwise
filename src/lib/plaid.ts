import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import type { Transaction } from "plaid";
import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import { toDecimal } from "./format";
import { applyRulesToTransaction } from "./rules";
import { logger } from "./logger";

export function plaidAvailable(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

function env(): keyof typeof PlaidEnvironments {
  return (process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || "sandbox";
}

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set");
  const config = new Configuration({
    basePath: PlaidEnvironments[env()],
    baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } },
  });
  return new PlaidApi(config);
}

export async function createLinkToken(userId: string) {
  const client = getPlaidClient();
  const res = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Billwise",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

export interface ExchangeResult {
  itemId: string;
  institutionName?: string;
}

export async function exchangePublicToken(
  userId: string,
  publicToken: string,
  institutionName?: string,
): Promise<ExchangeResult> {
  const client = getPlaidClient();
  const res = await client.itemPublicTokenExchange({ public_token: publicToken });
  const { access_token, item_id } = res.data;
  await prisma.plaidItem.create({
    data: {
      userId,
      itemId: item_id,
      accessToken: encrypt(access_token),
      institutionName: institutionName ?? null,
    },
  });
  return { itemId: item_id, institutionName };
}

export type PlaidTxLike = Pick<
  Transaction,
  "transaction_id" | "name" | "amount" | "date" | "merchant_name" | "iso_currency_code" | "pending"
>;

/** Pure mapping from a Plaid transaction to our model fields. Exported for testing. */
export function mapPlaidTx(pt: PlaidTxLike) {
  const amount = Number(pt.amount);
  // Plaid: positive amount = money out (expense); negative = money in (income).
  // Zero/neutral defaults to expense.
  const type = amount >= 0 ? "expense" : "income";
  return {
    merchant: pt.merchant_name || pt.name || "Unknown",
    description: pt.name,
    amount: toDecimal(Math.abs(amount)),
    currency: pt.iso_currency_code || "USD",
    type,
    date: new Date(pt.date),
    source: "plaid",
    externalSource: "plaid",
    externalId: pt.transaction_id,
  };
}

export interface SyncResult {
  itemId: string;
  added: number;
  modified: number;
  removed: number;
}

/** Pull new/changed transactions for a Plaid item and upsert them. */
export async function syncItem(item: {
  id: number;
  userId: string;
  itemId: string;
  accessToken: string;
  cursor: string | null;
}): Promise<SyncResult> {
  const client = getPlaidClient();
  const accessToken = decrypt(item.accessToken);
  let cursor = item.cursor;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await client.transactionsSync({ access_token: accessToken, cursor: cursor ?? undefined });
    const data = res.data;

    for (const pt of data.added) {
      await upsertPlaidTransaction(item.userId, pt);
      added++;
    }
    for (const pt of data.modified) {
      await upsertPlaidTransaction(item.userId, pt);
      modified++;
    }
    for (const pt of data.removed) {
      await prisma.transaction.deleteMany({
        where: { userId: item.userId, externalSource: "plaid", externalId: pt.transaction_id },
      });
      removed++;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { cursor, lastSyncedAt: new Date() },
  });

  logger.info({ event: "plaid.sync", itemId: item.itemId, added, modified, removed });
  return { itemId: item.itemId, added, modified, removed };
}

async function upsertPlaidTransaction(userId: string, pt: PlaidTxLike) {
  const mapped = mapPlaidTx(pt);
  const tx = await prisma.transaction.upsert({
    where: {
      userId_externalSource_externalId: {
        userId,
        externalSource: "plaid",
        externalId: mapped.externalId,
      },
    },
    update: {
      merchant: mapped.merchant,
      description: mapped.description,
      amount: mapped.amount,
      currency: mapped.currency,
      type: mapped.type,
      date: mapped.date,
    },
    create: {
      ...mapped,
      userId,
    },
    include: { category: true, labels: true },
  });

  // (Re)evaluate rules against this transaction.
  await prisma.flag.deleteMany({ where: { transactionId: tx.id } });
  await applyRulesToTransaction(tx.id, userId, {
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    labelNames: tx.labels.map((l) => l.name),
  });
}

/** Sync all of a user's linked items. */
export async function syncAllItems(userId: string): Promise<SyncResult[]> {
  const items = await prisma.plaidItem.findMany({ where: { userId } });
  const results: SyncResult[] = [];
  for (const item of items) {
    try {
      results.push(await syncItem(item));
    } catch (err) {
      logger.error({ event: "plaid.sync.error", itemId: item.itemId, message: (err as Error).message });
    }
  }
  return results;
}

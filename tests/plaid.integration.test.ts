import { describe, it, expect, beforeEach } from "vitest";
import { Products } from "plaid";
import { prisma } from "@/lib/prisma";
import {
  plaidAvailable,
  getPlaidClient,
  exchangePublicToken,
  syncItem,
} from "@/lib/plaid";

// Real Plaid sandbox integration. Runs only when PLAID_CLIENT_ID/SECRET are
// present in the environment (local). Skipped in CI where no creds exist.
const describeIntegration = describe.skipIf(!plaidAvailable());

describeIntegration("Plaid sandbox end-to-end", () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.flag.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.plaidItem.deleteMany();
    await prisma.user.deleteMany();
    const u = await prisma.user.create({ data: { email: "plaid@test.io", passwordHash: "x" } });
    userId = u.id;
  });

  it("creates a sandbox item, syncs transactions, and stores them deduped", async () => {
    const client = getPlaidClient();

    // Generate a sandbox public token for a test institution.
    const pt = await client.sandboxPublicTokenCreate({
      institution_id: "ins_109508",
      initial_products: [Products.Transactions],
    });
    const publicToken = pt.data.public_token;

    // Exchange → stores an encrypted PlaidItem.
    const { itemId } = await exchangePublicToken(userId, publicToken, "Test Bank");
    const item = await prisma.plaidItem.findUnique({ where: { itemId } });
    expect(item).not.toBeNull();
    expect(item?.accessToken).not.toBe(""); // encrypted, non-empty
    expect(item?.accessToken).not.toContain(publicToken); // not plaintext

    // Sync → pulls transactions.
    const result = await syncItem(item!);
    expect(result.itemId).toBe(itemId);

    // Whatever Plaid returned, any stored rows must be tagged as plaid.
    const stored = await prisma.transaction.findMany({ where: { userId, externalSource: "plaid" } });
    for (const tx of stored) {
      expect(tx.source).toBe("plaid");
      expect(tx.externalId).toBeTruthy();
      expect(tx.amount).toBeGreaterThan(-1);
    }

    // Re-running sync should not duplicate (dedupe by externalId).
    const result2 = await syncItem(item!);
    const stored2 = await prisma.transaction.findMany({ where: { userId, externalSource: "plaid" } });
    expect(stored2.length).toBe(stored.length);
    expect(result2.added).toBe(0);
  }, 60_000);
});

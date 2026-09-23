import { describe, it, expect } from "vitest";
import { shouldSyncWebhook } from "@/lib/plaid";

describe("shouldSyncWebhook", () => {
  it("triggers sync for transaction-update codes", () => {
    expect(shouldSyncWebhook("SYNC_UPDATES_AVAILABLE")).toBe(true);
    expect(shouldSyncWebhook("DEFAULT_UPDATE")).toBe(true);
    expect(shouldSyncWebhook("HISTORICAL_UPDATE")).toBe(true);
  });

  it("ignores non-transaction webhook codes", () => {
    expect(shouldSyncWebhook("ITEM_LOGIN_RECOVER")).toBe(false);
    expect(shouldSyncWebhook("PENDING_EXPIRATION")).toBe(false);
    expect(shouldSyncWebhook("WEBHOOK_UPDATE_ACKNOWLEDGED")).toBe(false);
    expect(shouldSyncWebhook("")).toBe(false);
  });
});

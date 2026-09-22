-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "externalId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "externalSource" TEXT;

-- CreateTable
CREATE TABLE "plaid_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "cursor" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plaid_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_itemId_key" ON "plaid_items"("itemId");

-- CreateIndex
CREATE INDEX "plaid_items_userId_idx" ON "plaid_items"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_userId_externalSource_externalId_key" ON "transactions"("userId", "externalSource", "externalId");


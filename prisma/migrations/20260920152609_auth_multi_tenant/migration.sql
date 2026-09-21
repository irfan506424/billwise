/*
  Warnings:

  - Added the required column `userId` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `labels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `recommendations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `rules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "budget" DECIMAL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_categories" ("budget", "color", "createdAt", "id", "name") SELECT "budget", "color", "createdAt", "id", "name" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE INDEX "categories_userId_idx" ON "categories"("userId");
CREATE UNIQUE INDEX "categories_userId_name_key" ON "categories"("userId", "name");
CREATE TABLE "new_labels" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#22c55e',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "labels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_labels" ("color", "createdAt", "id", "name") SELECT "color", "createdAt", "id", "name" FROM "labels";
DROP TABLE "labels";
ALTER TABLE "new_labels" RENAME TO "labels";
CREATE INDEX "labels_userId_idx" ON "labels"("userId");
CREATE UNIQUE INDEX "labels_userId_name_key" ON "labels"("userId", "name");
CREATE TABLE "new_recommendations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "potentialSavings" DECIMAL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_recommendations" ("body", "category", "createdAt", "dismissed", "id", "potentialSavings", "severity", "title") SELECT "body", "category", "createdAt", "dismissed", "id", "potentialSavings", "severity", "title" FROM "recommendations";
DROP TABLE "recommendations";
ALTER TABLE "new_recommendations" RENAME TO "recommendations";
CREATE INDEX "recommendations_userId_idx" ON "recommendations"("userId");
CREATE TABLE "new_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'flag',
    "message" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "categoryId" INTEGER,
    CONSTRAINT "rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_rules" ("action", "categoryId", "createdAt", "description", "enabled", "field", "id", "message", "name", "operator", "value") SELECT "action", "categoryId", "createdAt", "description", "enabled", "field", "id", "message", "name", "operator", "value" FROM "rules";
DROP TABLE "rules";
ALTER TABLE "new_rules" RENAME TO "rules";
CREATE INDEX "rules_userId_idx" ON "rules"("userId");
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "merchant" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" TEXT NOT NULL DEFAULT 'expense',
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "rawText" TEXT,
    "lineItems" TEXT,
    "tax" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "categoryId" INTEGER,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("amount", "categoryId", "createdAt", "currency", "date", "description", "id", "lineItems", "merchant", "rawText", "source", "tax", "type") SELECT "amount", "categoryId", "createdAt", "currency", "date", "description", "id", "lineItems", "merchant", "rawText", "source", "tax", "type" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_userId_date_idx" ON "transactions"("userId", "date");
CREATE INDEX "transactions_userId_categoryId_idx" ON "transactions"("userId", "categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

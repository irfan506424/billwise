-- CreateTable
CREATE TABLE "hidden_fees" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "estimatedMonthly" DECIMAL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "hidden_fees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hidden_fees_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "hidden_fees_userId_dismissed_idx" ON "hidden_fees"("userId", "dismissed");

-- CreateIndex
CREATE UNIQUE INDEX "hidden_fees_userId_transactionId_key" ON "hidden_fees"("userId", "transactionId");


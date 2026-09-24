-- AlterTable
ALTER TABLE "users" ADD COLUMN "inboundEmail" TEXT;

-- CreateTable
CREATE TABLE "monthly_reports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "monthly_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "savings_platforms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "matchTags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "monthly_reports_userId_idx" ON "monthly_reports"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reports_userId_month_key" ON "monthly_reports"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "savings_platforms_name_key" ON "savings_platforms"("name");


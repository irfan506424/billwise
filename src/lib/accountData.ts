import { prisma } from "./prisma";

export interface UserExport {
  user: { id: string; email: string; name: string | null; createdAt: string; plan: string };
  transactions: unknown[];
  categories: unknown[];
  labels: unknown[];
  rules: unknown[];
  recommendations: unknown[];
  hiddenFees: unknown[];
  monthlyReports: unknown[];
  savingsRecommendations: unknown[];
  payments: unknown[];
  plaidItems: unknown[];
  stripeAccounts: unknown[];
  auditLogs: unknown[];
}

/** Gather all of a user's data for GDPR export (right to data portability). */
export async function gatherUserExport(userId: string): Promise<UserExport> {
  const [
    user,
    transactions,
    categories,
    labels,
    rules,
    recommendations,
    hiddenFees,
    monthlyReports,
    savings,
    payments,
    plaidItems,
    stripeAccounts,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true, plan: true } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.label.findMany({ where: { userId } }),
    prisma.rule.findMany({ where: { userId } }),
    prisma.recommendation.findMany({ where: { userId } }),
    prisma.hiddenFee.findMany({ where: { userId } }),
    prisma.monthlyReport.findMany({ where: { userId } }),
    // savings are global catalog, not per-user — skip
    Promise.resolve([]),
    prisma.payment.findMany({ where: { userId } }),
    prisma.plaidItem.findMany({ where: { userId }, select: { itemId: true, institutionName: true, institutionId: true, lastSyncedAt: true, createdAt: true } }),
    prisma.stripeAccount.findMany({ where: { userId }, select: { accountId: true, lastSyncedAt: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { userId }, select: { action: true, targetType: true, targetId: true, createdAt: true } }),
  ]);

  if (!user) throw new Error("User not found");

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      plan: user.plan,
    },
    transactions,
    categories,
    labels,
    rules,
    recommendations,
    hiddenFees,
    monthlyReports,
    savingsRecommendations: savings,
    payments,
    plaidItems,
    stripeAccounts,
    auditLogs,
  };
}

/** Delete a user and all their data (cascade). For GDPR "right to be forgotten." */
export async function deleteUser(userId: string): Promise<void> {
  // Relations are onDelete: Cascade, so deleting the user removes all their data.
  await prisma.user.delete({ where: { id: userId } });
}

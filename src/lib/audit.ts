import { prisma } from "./prisma";

export type AuditAction =
  | "user.registered"
  | "user.login"
  | "user.logout"
  | "plaid.connect"
  | "plaid.disconnect"
  | "stripe.connect"
  | "stripe.disconnect"
  | "transaction.create"
  | "transaction.delete"
  | "category.delete"
  | "rule.create"
  | "rule.delete"
  | "billing.subscribed"
  | "billing.canceled"
  | "recommendation.dismissed"
  | "user.ai_settings_updated"
  | "payment.sent"
  | "payment.received"
  | "user.data_exported"
  | "user.account_deleted";

/**
 * Record a security-relevant event in the audit log.
 * Fire-and-forget: never throws (logs to stderr on failure so it can't break the request).
 */
export async function audit(
  userId: string,
  action: AuditAction,
  opts: { targetType?: string; targetId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch (e) {
    console.error("audit log failed:", (e as Error).message);
  }
}

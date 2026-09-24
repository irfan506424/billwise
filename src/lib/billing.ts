import Stripe from "stripe";
import { prisma } from "./prisma";
import { logger } from "./logger";

export type Plan = "free" | "pro" | "enterprise";

export function billingAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion });
}

const PRICE_BY_PLAN: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

/** Create a Stripe Checkout session for subscribing to a plan. Returns a URL to redirect to. */
export async function createCheckoutSession(userId: string, email: string, plan: Plan): Promise<string> {
  const price = PRICE_BY_PLAN[plan];
  if (!price) throw new Error(`No Stripe price configured for plan "${plan}"`);
  const stripe = stripeClient();
  const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/pricing?success=1`,
    cancel_url: `${origin}/pricing?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Create a Stripe billing portal session for managing the subscription. */
export async function createPortalSession(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer to open portal for");
  const stripe = stripeClient();
  const origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/pricing`,
  });
  return session.url;
}

/** Read a user's plan. */
export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Grace: if a paid subscription has lapsed past its end date, treat as free.
  if (user?.subscriptionEndsAt && user.subscriptionEndsAt < new Date() && user.plan !== "free") {
    return "free";
  }
  return (user?.plan as Plan) || "free";
}

/** Returns true if the user's plan is at least `required`. */
export async function hasPlan(userId: string, required: Plan): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const rank: Record<Plan, number> = { free: 0, pro: 1, enterprise: 2 };
  return rank[plan] >= rank[required];
}

/** Verify + handle a Stripe webhook event (billing). */
export async function handleBillingWebhook(rawBody: string, signature: string): Promise<void> {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = event.data.object.client_reference_id as string | null;
      const customerId = event.data.object.customer as string;
      const sub = event.data.object.subscription as string | null;
      if (userId) {
        const lineItems = await stripe.checkout.sessions.listLineItems(event.data.object.id, { limit: 1 });
        const price = lineItems.data[0]?.price?.id;
        const plan: Plan = price === process.env.STRIPE_PRICE_PRO ? "pro" : price === process.env.STRIPE_PRICE_ENTERPRISE ? "enterprise" : "pro";
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId, plan, subscriptionStatus: "active", subscriptionEndsAt: null },
        });
        void sub;
        logger.info({ event: "billing.subscribed", userId, plan });
      }
      break;
    }
    case "customer.subscription.updated": {
      const customerId = event.data.object.customer as string;
      const status = event.data.object.status as string;
      const endedAt = (event.data.object as { current_period_end?: number }).current_period_end;
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: status, subscriptionEndsAt: endedAt ? new Date(endedAt * 1000) : null },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const customerId = event.data.object.customer as string;
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "free", subscriptionStatus: "canceled", subscriptionEndsAt: new Date() },
      });
      break;
    }
    default:
      break;
  }
}

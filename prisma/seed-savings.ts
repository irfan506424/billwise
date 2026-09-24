import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Curated catalog of apps/platforms that save users money, tagged by the
// spending categories they help with (matchTags) and a category bucket.
const PLATFORMS = [
  { name: "Rakuten", category: "cashback", url: "https://www.rakuten.com", description: "Cashback at thousands of stores — earn on dining, shopping, travel.", matchTags: "Dining,Shopping,Travel,Groceries" },
  { name: "Honey", category: "coupon", url: "https://www.joinhoney.com", description: "Auto-applies coupons + price tracking at checkout on shopping sites.", matchTags: "Shopping" },
  { name: "RetailMeNot", category: "coupon", url: "https://www.retailmenot.com", description: "Coupon codes for online + in-store merchants.", matchTags: "Shopping,Dining" },
  { name: "Truebill / Rocket Money", category: "subscription_negotiator", url: "https://www.rocketmoney.com", description: "Finds + cancels forgotten subscriptions and negotiates bills down.", matchTags: "Subscriptions,Dining,Utilities" },
  { name: "AskTrim", category: "subscription_negotiator", url: "https://www.asktrim.com", description: "Negotiates subscriptions, cable, internet, and phone bills down.", matchTags: "Subscriptions,Utilities,Dining" },
  { name: "Mint (Credit Karma)", category: "budgeting", url: "https://www.mint.intuit.com", description: "Free budgeting + spend tracking + bill negotiation.", matchTags: "Dining,Groceries,Shopping,Transport,Subscriptions" },
  { name: "YNAB (You Need A Budget)", category: "budgeting", url: "https://www.youneedabudget.com", description: "Zero-based budgeting — proactive envelope method.", matchTags: "Groceries,Dining,Shopping" },
  { name: "GasBuddy", category: "cashback", url: "https://www.gasbuddy.com", description: "Cheapest gas near you + cash back on fill-ups.", matchTags: "Transport" },
  { name: "Fetch Rewards", category: "cashback", url: "https://www.fetch.com", description: "Snap any receipt → earn points → gift cards. Pairs with receipt OCR.", matchTags: "Groceries,Dining,Shopping" },
  { name: "Paribus", category: "subscription_negotiator", url: "https://www.paribus.com", description: "Auto-refunds on price drops + delayed shipments.", matchTags: "Shopping,Subscriptions" },
  { name: "Empower", category: "bill_negotiator", url: "https://www.empower.com", description: "Negotiates medical, internet, and wireless bills down.", matchTags: "Utilities,Health" },
  { name: "Billshark", category: "bill_negotiator", url: "https://www.billshark.com", description: "Negotiates cable, internet, phone, wireless, and satellite bills.", matchTags: "Utilities,Subscriptions" },
  { name: "CouponCabin", category: "coupon", url: "https://www.couponcabin.com", description: "Grocery + local merchant coupons and cash back.", matchTags: "Groceries,Dining" },
  { name: "Ibotta", category: "cashback", url: "https://www.ibotta.com", description: "Cash back on groceries + everyday purchases.", matchTags: "Groceries,Dining" },
  { name: "Dosh", category: "cashback", url: "https://www.dosh.cash", description: "Automatic cash back at restaurants + hotels — no scanning.", matchTags: "Dining,Travel" },
  { name: "Upside", category: "cashback", url: "https://www.getupside.com", description: "Cash back on gas + restaurants + groceries.", matchTags: "Transport,Dining,Groceries" },
  { name: "Card Curated", category: "cashback", url: "https://www.cardcurated.com", description: "Picks the best cashback/rewards credit card for your spend.", matchTags: "Dining,Shopping,Travel,Groceries,Transport" },
];

async function main() {
  for (const p of PLATFORMS) {
    await prisma.savingsPlatform.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }
  console.log(`Seeded ${PLATFORMS.length} savings platforms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

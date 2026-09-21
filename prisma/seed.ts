import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@billwise.app";
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash },
  });
  const userId = user.id;

  const categories = await Promise.all(
    [
      { name: "Groceries", color: "#22c55e", budget: 600 },
      { name: "Dining", color: "#f97316", budget: 300 },
      { name: "Subscriptions", color: "#8b5cf6", budget: 80 },
      { name: "Utilities", color: "#0ea5e9", budget: 250 },
      { name: "Transport", color: "#eab308", budget: 200 },
      { name: "Shopping", color: "#ec4899", budget: 400 },
      { name: "Income", color: "#10b981", budget: 0 },
    ].map((c) =>
      prisma.category.upsert({
        where: { userId_name: { userId, name: c.name } },
        update: {},
        create: { ...c, userId },
      }),
    ),
  );

  const labels = await Promise.all(
    ["Recurring", "Tax-deductible", "Reimbursable", "Impulse", "Family"].map((name) =>
      prisma.label.upsert({
        where: { userId_name: { userId, name } },
        update: {},
        create: { name, userId },
      }),
    ),
  );

  const byName = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const labelById = Object.fromEntries(labels.map((l) => [l.name, l.id]));

  const today = new Date();
  const d = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86400000);

  const txs = [
    { merchant: "Whole Foods", amount: 142.18, category: "Groceries", date: d(2), source: "manual", description: "Weekly groceries" },
    { merchant: "Trader Joe's", amount: 58.4, category: "Groceries", date: d(9), source: "manual" },
    { merchant: "Chipotle", amount: 24.85, category: "Dining", date: d(1), source: "manual" },
    { merchant: "Uber Eats", amount: 41.2, category: "Dining", date: d(3), source: "manual", description: "Late night" },
    { merchant: "Netflix", amount: 22.99, category: "Subscriptions", date: d(5), source: "manual", description: "Monthly" },
    { merchant: "Spotify", amount: 11.99, category: "Subscriptions", date: d(12), source: "manual" },
    { merchant: "Adobe Creative Cloud", amount: 59.99, category: "Subscriptions", date: d(20), source: "manual", description: "Annual monthly plan" },
    { merchant: "PG&E", amount: 187.5, category: "Utilities", date: d(7), source: "csv" },
    { merchant: "Comcast", amount: 89.99, category: "Utilities", date: d(15), source: "csv", description: "Internet — price increased" },
    { merchant: "Shell Gas", amount: 52.3, category: "Transport", date: d(4), source: "manual" },
    { merchant: "Uber", amount: 18.4, category: "Transport", date: d(6), source: "manual" },
    { merchant: "Amazon", amount: 234.5, category: "Shopping", date: d(8), source: "manual", description: "Impulse gadgets" },
    { merchant: "Amazon", amount: 67.2, category: "Shopping", date: d(11), source: "manual" },
    { merchant: "Salary - Acme Corp", amount: 5200, category: "Income", date: d(10), source: "csv", type: "income" },
  ];

  for (const t of txs) {
    await prisma.transaction.create({
      data: {
        merchant: t.merchant,
        amount: t.amount,
        date: t.date,
        source: t.source,
        description: t.description ?? null,
        type: (t as { type?: string }).type ?? "expense",
        userId,
        categoryId: byName[t.category] ?? null,
        labels: {
          connect:
            t.merchant === "Netflix" || t.merchant === "Spotify" || t.merchant === "Adobe Creative Cloud"
              ? [{ id: labelById["Recurring"] }]
              : t.merchant === "Amazon"
                ? [{ id: labelById["Impulse"] }]
                : [],
        },
      },
    });
  }

  await prisma.rule.createMany({
    data: [
      { name: "Flag Amazon impulse buys", field: "merchant", operator: "contains", value: "Amazon", action: "flag", message: "Amazon purchase — check if planned", userId },
      { name: "Alert on big dining spend", field: "amount", operator: "gt", value: "40", action: "flag_savings", message: "Dining over $40 — consider cooking", userId, categoryId: byName["Dining"] },
    ],
  });

  console.log("Seed complete. Login: demo@billwise.app / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

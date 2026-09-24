import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getUserPlan, hasPlan } from "@/lib/billing";

describe("billing plan logic", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it("defaults to free for a new user", async () => {
    const u = await prisma.user.create({ data: { email: "b1@t.io", passwordHash: "x" } });
    expect(await getUserPlan(u.id)).toBe("free");
  });

  it("returns the stored plan when active", async () => {
    const u = await prisma.user.create({ data: { email: "b2@t.io", passwordHash: "x", plan: "pro" } });
    expect(await getUserPlan(u.id)).toBe("pro");
  });

  it("downgrades to free when a paid subscription has lapsed", async () => {
    const u = await prisma.user.create({
      data: { email: "b3@t.io", passwordHash: "x", plan: "pro", subscriptionEndsAt: new Date(Date.now() - 86400000) },
    });
    expect(await getUserPlan(u.id)).toBe("free");
  });

  it("keeps the paid plan when the subscription end is in the future", async () => {
    const u = await prisma.user.create({
      data: { email: "b4@t.io", passwordHash: "x", plan: "pro", subscriptionEndsAt: new Date(Date.now() + 86400000) },
    });
    expect(await getUserPlan(u.id)).toBe("pro");
  });

  it("hasPlan ranks plans and gates correctly", async () => {
    const free = await prisma.user.create({ data: { email: "f@t.io", passwordHash: "x", plan: "free" } });
    const pro = await prisma.user.create({ data: { email: "p@t.io", passwordHash: "x", plan: "pro" } });
    const ent = await prisma.user.create({ data: { email: "e@t.io", passwordHash: "x", plan: "enterprise" } });

    expect(await hasPlan(free.id, "pro")).toBe(false);
    expect(await hasPlan(free.id, "free")).toBe(true);
    expect(await hasPlan(pro.id, "pro")).toBe(true);
    expect(await hasPlan(pro.id, "enterprise")).toBe(false);
    expect(await hasPlan(ent.id, "enterprise")).toBe(true);
    expect(await hasPlan(ent.id, "pro")).toBe(true);
  });
});

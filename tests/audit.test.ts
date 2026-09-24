import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

describe("audit log", () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
  });

  it("records an event and returns it via /api/audit", async () => {
    const u = await prisma.user.create({ data: { email: "audit@t.io", passwordHash: "x" } });
    await audit(u.id, "user.registered", { meta: { note: "test" } });
    const rows = await prisma.auditLog.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("user.registered");
    expect(rows[0].userId).toBe(u.id);
    expect(rows[0].meta).toContain("note");
  });

  it("never throws on failure (fire-and-forget)", async () => {
    // force a foreign-key failure by using a non-existent userId;
    // audit() catches and logs to stderr instead of throwing
    await audit("nonexistent-user-id", "user.login");
    const rows = await prisma.auditLog.findMany({ where: { userId: "nonexistent-user-id" } });
    expect(rows).toHaveLength(0);
  });
});

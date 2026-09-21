import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Control the authenticated user from the route's perspective.
vi.mock("@/lib/auth", () => ({ getUserId: vi.fn() }));
import { getUserId } from "@/lib/auth";

// Import the route handlers after the mock is in place.
import { GET, POST } from "@/app/api/transactions/route";

function jsonReq(path: string, init?: RequestInit & { method?: string }) {
  return new NextRequest(`http://localhost${path}`, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body,
  });
}

let userA: string;
let userB: string;

beforeEach(async () => {
  // clean slate per test
  await prisma.flag.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.label.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.user.deleteMany();

  const a = await prisma.user.create({ data: { email: "a@test.io", passwordHash: "x" } });
  const b = await prisma.user.create({ data: { email: "b@test.io", passwordHash: "x" } });
  userA = a.id;
  userB = b.id;
  vi.mocked(getUserId).mockReset();
});

describe("transactions API — auth + isolation", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUserId).mockResolvedValue(null);
    const res = await GET(jsonReq("/api/transactions"));
    expect(res.status).toBe(401);
  });

  it("isolates transactions between users", async () => {
    // user A creates a transaction
    vi.mocked(getUserId).mockResolvedValue(userA);
    const createRes = await POST(
      jsonReq("/api/transactions", { method: "POST", body: JSON.stringify({ merchant: "A's Coffee", amount: 5 }) }),
    );
    expect(createRes.status).toBe(201);

    // user A sees it
    vi.mocked(getUserId).mockResolvedValue(userA);
    const aList = await GET(jsonReq("/api/transactions"));
    const aJson = await aList.json();
    expect(aJson).toHaveLength(1);
    expect(aJson[0].merchant).toBe("A's Coffee");

    // user B sees zero — isolation holds
    vi.mocked(getUserId).mockResolvedValue(userB);
    const bList = await GET(jsonReq("/api/transactions"));
    const bJson = await bList.json();
    expect(bJson).toHaveLength(0);
  });

  it("rejects invalid input with 400", async () => {
    vi.mocked(getUserId).mockResolvedValue(userA);
    const res = await POST(
      jsonReq("/api/transactions", { method: "POST", body: JSON.stringify({ merchant: "", amount: 5 }) }),
    );
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe("Validation failed");
  });

  it("runs rules and attaches flags on create", async () => {
    vi.mocked(getUserId).mockResolvedValue(userA);
    await prisma.rule.create({
      data: {
        name: "Flag coffee",
        field: "merchant",
        operator: "contains",
        value: "Coffee",
        action: "flag",
        message: "coffee spend",
        userId: userA,
      },
    });
    const res = await POST(
      jsonReq("/api/transactions", { method: "POST", body: JSON.stringify({ merchant: "Coffee Bean", amount: 4 }) }),
    );
    expect(res.status).toBe(201);
    await res.json();
    // flags are not included in the create response; re-fetch via GET
    vi.mocked(getUserId).mockResolvedValue(userA);
    const list = await GET(jsonReq("/api/transactions"));
    const [fetched] = await list.json();
    expect(fetched.flags.length).toBeGreaterThan(0);
    expect(fetched.flags[0].reason).toBe("coffee spend");
  });
});

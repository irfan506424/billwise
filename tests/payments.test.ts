import { describe, it, expect } from "vitest";
import { appFeeCents } from "@/lib/payments";

describe("payments pure helpers", () => {
  it("appFeeCents is 0 for MVP (no platform fee yet)", () => {
    expect(appFeeCents(10000)).toBe(0);
    expect(appFeeCents(0)).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { mapStripeCharge } from "@/lib/stripe";

describe("mapStripeCharge", () => {
  it("maps a charge to an income transaction with cents→dollars", () => {
    const m = mapStripeCharge({
      id: "ch_1",
      amount: 4250, // cents → $42.50
      currency: "usd",
      created: 1727132800, // unix seconds
      description: "Acme invoice #1042",
      receipt_email: "billing@acme.com",
    });
    expect(m.type).toBe("income");
    expect(m.source).toBe("stripe");
    expect(m.externalSource).toBe("stripe");
    expect(m.externalId).toBe("ch_1");
    expect(m.amount).toBeCloseTo(42.5, 2);
    expect(m.currency).toBe("USD");
    expect(m.merchant).toBe("billing@acme.com");
    expect(m.date).toEqual(new Date(1727132800 * 1000));
  });

  it("falls back to description when receipt_email is missing", () => {
    const m = mapStripeCharge({
      id: "ch_2",
      amount: 1000,
      currency: "eur",
      created: 1727132800,
      description: "Consulting fee",
      receipt_email: null,
    });
    expect(m.merchant).toBe("Consulting fee");
    expect(m.currency).toBe("EUR");
  });

  it("falls back to 'Stripe payment' when both email and description are null", () => {
    const m = mapStripeCharge({
      id: "ch_3",
      amount: 500,
      currency: "usd",
      created: 1727132800,
      description: null,
      receipt_email: null,
    });
    expect(m.merchant).toBe("Stripe payment");
  });

  it("defaults currency to USD when missing", () => {
    const m = mapStripeCharge({
      id: "ch_4",
      amount: 200,
      currency: "",
      created: 1727132800,
      description: "x",
      receipt_email: null,
    });
    expect(m.currency).toBe("USD");
  });
});

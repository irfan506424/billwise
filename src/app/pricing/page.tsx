"use client";

import { useEffect, useState } from "react";

type Plan = "free" | "pro" | "enterprise";

const TIERS: { plan: Plan; price: string; blurb: string; features: string[] }[] = [
  {
    plan: "free",
    price: "$0",
    blurb: "For getting started",
    features: ["Manual + CSV entry", "1 bank via Plaid", "Rules engine", "Basic insights"],
  },
  {
    plan: "pro",
    price: "$9/mo",
    blurb: "For active trackers",
    features: ["Everything in Free", "Unlimited Plaid banks", "Stripe/PayPal import", "AI review", "All charts"],
  },
  {
    plan: "enterprise",
    price: "Custom",
    blurb: "For teams",
    features: ["Everything in Pro", "Unlimited everything", "Priority support", "SAML SSO", "Audit log"],
  },
];

export default function PricingPage() {
  const [plan, setPlan] = useState<Plan>("free");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/plan").then((r) => r.json()).then((d) => setPlan(d.plan)).catch(() => {});
  }, []);

  async function subscribe(target: Plan) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: target }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Checkout failed");
      return;
    }
    window.location.href = j.url;
  }

  async function manage() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Portal failed");
      return;
    }
    window.location.href = j.url;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm opacity-60">You&apos;re on the <strong className="capitalize">{plan}</strong> plan.</p>
      </div>

      {msg && <div className="text-sm rounded-md px-3 py-2 bg-red-500/10 text-red-600">{msg}</div>}

      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((t) => {
          const current = t.plan === plan;
          return (
            <div key={t.plan} className={`rounded-xl border p-5 flex flex-col ${current ? "border-indigo-500" : "border-black/10 dark:border-white/10"}`}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium capitalize">{t.plan}</h2>
                {current && <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{t.price}</div>
              <p className="text-sm opacity-60 mt-1">{t.blurb}</p>
              <ul className="text-sm space-y-1 my-4 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                ))}
              </ul>
              {current ? (
                <button onClick={manage} disabled={busy} className="rounded-md bg-black/5 dark:bg-white/10 px-4 py-2 text-sm disabled:opacity-50">
                  Manage subscription
                </button>
              ) : (
                <button
                  onClick={() => subscribe(t.plan)}
                  disabled={busy}
                  className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {busy ? "Working…" : `Upgrade to ${t.plan}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs opacity-50">
        Requires STRIPE_SECRET_KEY, STRIPE_PRICE_PRO / STRIPE_PRICE_ENTERPRISE, and STRIPE_WEBHOOK_SECRET.
        Configure products at dashboard.stripe.com → Products, then paste the price IDs (price_…) into env vars.
      </p>
    </div>
  );
}

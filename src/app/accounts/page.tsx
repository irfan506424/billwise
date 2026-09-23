"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

type PlaidItem = {
  id: number;
  itemId: string;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

type StripeItem = {
  id: number;
  accountId: string;
  lastSyncedAt: string | null;
  createdAt: string;
};

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: { institution?: { name?: string } }) => void;
        onExit: (err: unknown, metadata: unknown) => void;
        onLoad: () => void;
      }) => { open: () => void; destroy: () => void };
    };
  }
}

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link.js";

export default function AccountsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [stripeItems, setStripeItems] = useState<StripeItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptBlocked, setScriptBlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Plaid) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${PLAID_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true));
      existing.addEventListener("error", () => setScriptBlocked(true));
      return;
    }
    const s = document.createElement("script");
    s.src = PLAID_SCRIPT;
    s.async = true;
    s.onload = () => setScriptReady(true);
    s.onerror = () => setScriptBlocked(true);
    document.body.appendChild(s);
  }, []);

  async function loadItems() {
    const res = await fetch("/api/plaid/items");
    if (res.ok) setItems(await res.json());
  }
  async function loadStripeItems() {
    const res = await fetch("/api/stripe/items");
    if (res.ok) setStripeItems(await res.json());
  }
  useEffect(() => {
    loadItems();
    loadStripeItems();
    // Surface Stripe OAuth callback result passed back via ?connected= / ?error=
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connected") === "stripe") setMsg({ ok: true, text: "Stripe connected. Payments syncing as income." });
    const err = sp.get("error");
    if (err) setMsg({ ok: false, text: err });
  }, []);

  async function connect() {
    setBusy(true);
    setMsg(null);
    const ltRes = await fetch("/api/plaid/link-token", { method: "POST" });
    const ltJson = await ltRes.json();
    if (!ltRes.ok) {
      setBusy(false);
      setMsg({ ok: false, text: ltJson.error ?? "Could not start Plaid Link" });
      return;
    }
    const handler = window.Plaid!.create({
      token: ltJson.link_token,
      onSuccess: async (publicToken, metadata) => {
        const exRes = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name,
          }),
        });
        const exJson = await exRes.json();
        setBusy(false);
        if (!exRes.ok) {
          setMsg({ ok: false, text: exJson.error ?? "Exchange failed" });
          return;
        }
        setMsg({ ok: true, text: "Bank connected. Initial sync started." });
        loadItems();
        router.refresh();
      },
      onExit: () => {
        setBusy(false);
      },
      onLoad: () => {},
    });
    handler.open();
  }

  async function sandboxConnect() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/plaid/sandbox-connect", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "Sandbox connect failed" });
      return;
    }
    setMsg({ ok: true, text: `Sandbox bank connected. Synced +${j.added} new transactions.` });
    loadItems();
    router.refresh();
  }

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/plaid/sync", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "Sync failed" });
      return;
    }
    const t = j.totals ?? { added: 0, modified: 0, removed: 0 };
    setMsg({ ok: true, text: `Synced: +${t.added} new, ${t.modified} updated, ${t.removed} removed.` });
    loadItems();
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("Remove this bank and delete its synced transactions?")) return;
    setBusy(true);
    const res = await fetch(`/api/plaid/items?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Bank removed." });
      loadItems();
      router.refresh();
    } else {
      setMsg({ ok: false, text: "Failed to remove" });
    }
  }

  async function connectStripe() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/stripe/link-token", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "Could not start Stripe Connect" });
      return;
    }
    // Redirect the browser to Stripe's OAuth authorize URL.
    window.location.href = j.url;
  }

  async function stripeSyncNow() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/stripe/sync", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "Stripe sync failed" });
      return;
    }
    const t = j.totals ?? { added: 0 };
    setMsg({ ok: true, text: `Stripe synced: +${t.added} payments imported as income.` });
    loadStripeItems();
    router.refresh();
  }

  async function removeStripe(id: number) {
    if (!confirm("Remove this Stripe account and delete its synced payments?")) return;
    setBusy(true);
    const res = await fetch(`/api/stripe/items?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Stripe account removed." });
      loadStripeItems();
      router.refresh();
    } else {
      setMsg({ ok: false, text: "Failed to remove" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank accounts</h1>
          <p className="text-sm opacity-60">Connect banks & cards via Plaid. Transactions sync automatically.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncNow} disabled={busy || items.length === 0} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-sm disabled:opacity-50">
            Sync now
          </button>
          <button onClick={connect} disabled={busy || !scriptReady} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "Working…" : "Connect bank"}
          </button>
        </div>
      </div>

      {scriptBlocked && (
        <div className="text-sm rounded-md px-3 py-2 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          The Plaid Link script couldn’t load (your network may be blocking cdn.plaid.com).
          You can still connect a <strong>sandbox</strong> bank directly from the server:
          <button onClick={sandboxConnect} disabled={busy} className="ml-2 rounded-md bg-amber-500 text-white px-3 py-1 text-xs disabled:opacity-50">
            Connect sandbox bank
          </button>
        </div>
      )}

      {msg && (
        <div className={`text-sm rounded-md px-3 py-2 ${msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm opacity-60 rounded-xl border border-black/10 dark:border-white/10 p-5">
            No banks connected yet. Click <strong>Connect bank</strong> to link one via Plaid.
          </li>
        )}
        {items.map((it) => (
          <li key={it.id} className="rounded-lg border border-black/10 dark:border-white/10 p-4 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="flex-1">
              <div className="font-medium text-sm">{it.institutionName || "Linked institution"}</div>
              <div className="text-xs opacity-60">
                Last synced: {it.lastSyncedAt ? formatDate(it.lastSyncedAt) : "never"} · Added {formatDate(it.createdAt)}
              </div>
            </div>
            <button onClick={() => remove(it.id)} disabled={busy} className="text-xs opacity-50 hover:text-red-500 disabled:opacity-30">
              remove
            </button>
          </li>
        ))}
      </ul>

      <section className="pt-4 border-t border-black/10 dark:border-white/10">
        <div className="flex items-end justify-between mt-4">
          <div>
            <h2 className="font-medium">Payment processors (Stripe)</h2>
            <p className="text-sm opacity-60">Connect Stripe to import payments you receive as income.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={stripeSyncNow} disabled={busy || stripeItems.length === 0} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-sm disabled:opacity-50">
              Sync now
            </button>
            <button onClick={connectStripe} disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
              {busy ? "Working…" : "Connect Stripe"}
            </button>
          </div>
        </div>
        <ul className="space-y-2 mt-3">
          {stripeItems.length === 0 && (
            <li className="text-sm opacity-60 rounded-xl border border-black/10 dark:border-white/10 p-5">
              No Stripe accounts connected. Click <strong>Connect Stripe</strong>.
            </li>
          )}
          {stripeItems.map((it) => (
            <li key={it.id} className="rounded-lg border border-black/10 dark:border-white/10 p-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <div className="flex-1">
                <div className="font-medium text-sm">{it.accountId}</div>
                <div className="text-xs opacity-60">
                  Last synced: {it.lastSyncedAt ? formatDate(it.lastSyncedAt) : "never"} · Added {formatDate(it.createdAt)}
                </div>
              </div>
              <button onClick={() => removeStripe(it.id)} disabled={busy} className="text-xs opacity-50 hover:text-red-500 disabled:opacity-30">
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs opacity-50">
        Plaid: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV. Stripe: STRIPE_CONNECT_CLIENT_ID, STRIPE_SECRET_KEY (dashboard.stripe.com → Connect → OAuth).
      </p>
    </div>
  );
}

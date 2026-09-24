"use client";

import { useState } from "react";

function dateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AccountPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function exportData() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billwise-export-${dateStamp(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "Export downloaded." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("This permanently deletes your account and ALL your data. This cannot be undone. Continue?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (res.ok) {
        setMsg({ ok: true, text: "Account deleted. Redirecting to logout…" });
        setTimeout(() => (window.location.href = "/login"), 1500);
      } else {
        const j = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: j.error ?? "Delete failed." });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm opacity-60">Your data is yours — export it or delete it anytime.</p>
      </div>

      {msg && (
        <div className={`text-sm rounded-md px-3 py-2 ${msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-5 space-y-3">
        <h2 className="font-medium">Export your data (GDPR)</h2>
        <p className="text-sm opacity-70">Download everything Billwise stores for you as a JSON file — transactions, categories, labels, rules, recommendations, hidden fees, monthly reports, payments, and your audit log.</p>
        <button onClick={exportData} disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Preparing…" : "Export my data"}
        </button>
      </section>

      <section className="rounded-xl border border-red-500/30 p-5 space-y-3">
        <h2 className="font-medium text-red-600">Delete your account</h2>
        <p className="text-sm opacity-70">Permanently deletes your account and <strong>all</strong> your data — transactions, history, everything. This cannot be undone.</p>
        <button onClick={deleteAccount} disabled={busy} className="rounded-md bg-red-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </section>
    </div>
  );
}

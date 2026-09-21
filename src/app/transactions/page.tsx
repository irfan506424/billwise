"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

type Flag = { id: number; reason: string; severity: string };
type Tx = {
  id: number;
  merchant: string;
  description: string | null;
  amount: string;
  type: string;
  date: string;
  source: string;
  category: { id: number; name: string; color: string } | null;
  labels: { id: number; name: string; color: string }[];
  flags: Flag[];
};
type Category = { id: number; name: string; color: string };

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (catFilter) params.set("categoryId", catFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/transactions?${params}`);
    const j = await res.json();
    setTxs(j);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = useMemo(
    () => txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
    [txs],
  );

  async function setCategory(txId: number, categoryId: number | null) {
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: categoryId ?? null }),
    });
    load();
  }

  async function setLabels(txId: number, labelsStr: string) {
    const labels = labelsStr.split(",").map((s) => s.trim()).filter(Boolean);
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels }),
    });
    load();
  }

  async function del(txId: number) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
    load();
  }

  const inputCls = "rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm opacity-60">{txs.length} shown · {formatCurrency(total)} total spend</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className={inputCls} placeholder="Search merchant…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <button onClick={load} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-1.5 text-sm">Apply</button>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5 dark:bg-white/5 text-left text-xs opacity-70">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Merchant</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Labels</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Flags</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center opacity-50">Loading…</td></tr>
            )}
            {!loading && txs.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center opacity-50">No transactions. Add one from “Add bill”.</td></tr>
            )}
            {txs.map((t) => (
              <tr key={t.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(t.date)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{t.merchant}</div>
                  {t.description && <div className="text-xs opacity-50">{t.description}</div>}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={t.category?.id ?? ""}
                    onChange={(e) => setCategory(t.id, e.target.value ? Number(e.target.value) : null)}
                    className="rounded border border-black/15 dark:border-white/15 bg-transparent text-xs px-2 py-1"
                    style={{ color: t.category?.color }}
                  >
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={t.labels.map((l) => l.name).join(", ")}
                    onBlur={(e) => setLabels(t.id, e.target.value)}
                    placeholder="labels…"
                    className="rounded border border-black/15 dark:border-white/15 bg-transparent text-xs px-2 py-1 w-32"
                  />
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${t.type === "income" ? "text-emerald-500" : ""}`}>
                  {t.type === "income" ? "+" : "−"}{formatCurrency(t.amount)}
                </td>
                <td className="px-3 py-2">
                  {t.flags.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                      {t.flags.length} flag{t.flags.length > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => del(t.id)} className="text-xs opacity-50 hover:opacity-100 hover:text-red-500">delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Rule = {
  id: number;
  name: string;
  description: string | null;
  field: string;
  operator: string;
  value: string;
  action: string;
  message: string;
  enabled: boolean;
  category: { id: number; name: string } | null;
};

const FIELDS = ["merchant", "description", "amount", "category", "label"];
const OPERATORS = ["contains", "eq", "gt", "lt", "gte", "lte", "regex"];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    field: "merchant",
    operator: "contains",
    value: "",
    action: "flag",
    message: "",
    categoryId: "",
  });

  async function load() {
    const [r, c] = await Promise.all([
      fetch("/api/rules").then((x) => x.json()),
      fetch("/api/categories").then((x) => x.json()),
    ]);
    setRules(r);
    setCategories(c);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.value.trim()) return;
    setBusy(true);
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
      }),
    });
    setBusy(false);
    setForm({ ...form, name: "", value: "", message: "" });
    load();
  }

  async function toggle(r: Rule) {
    await fetch(`/api/rules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !r.enabled }) });
    load();
  }

  async function del(id: number) {
    if (!confirm("Delete rule?")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    load();
  }

  async function applyAll() {
    setBusy(true);
    const res = await fetch("/api/rules/apply", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    alert(`Evaluated ${j.evaluated} transactions, flagged ${j.flagged}.`);
    load();
  }

  const inputCls = "rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings rules</h1>
          <p className="text-sm opacity-60">Automatically flag transactions matching conditions you define.</p>
        </div>
        <button onClick={applyAll} disabled={busy} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-sm disabled:opacity-50">
          Re-run all rules
        </button>
      </div>

      <form onSubmit={add} className="rounded-xl border border-black/10 dark:border-white/10 p-4 grid md:grid-cols-6 gap-3">
        <input className={inputCls + " md:col-span-2"} placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={inputCls} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
          {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className={inputCls} value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
          {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input className={inputCls} placeholder="value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <input className={inputCls + " md:col-span-3"} placeholder="Flag message (shown on transaction)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <select className={inputCls} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          <option value="">Any category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={inputCls} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
          <option value="flag">flag</option>
          <option value="flag_savings">flag (savings)</option>
        </select>
        <button disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm md:col-span-1 disabled:opacity-50">Add rule</button>
      </form>

      <ul className="space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex items-center gap-3">
            <button
              onClick={() => toggle(r)}
              className={`w-10 h-6 rounded-full transition relative ${r.enabled ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${r.enabled ? "left-[18px]" : "left-0.5"}`} />
            </button>
            <div className="flex-1">
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs opacity-60 font-mono">
                {r.field} {r.operator} {r.value}
                {r.category ? ` · ${r.category.name}` : ""}
                {r.message ? ` — ${r.message}` : ""}
              </div>
            </div>
            <button onClick={() => del(r.id)} className="text-xs opacity-50 hover:text-red-500">delete</button>
          </li>
        ))}
        {rules.length === 0 && <li className="text-sm opacity-50">No rules yet. Example: merchant contains “Amazon” → flag impulse buys.</li>}
      </ul>
    </div>
  );
}

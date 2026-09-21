"use client";

import { useEffect, useState } from "react";

type Category = { id: number; name: string; color: string; budget: string; _count: { transactions: number } };
type Label = { id: number; name: string; color: string; _count: { transactions: number } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [c, l] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/labels").then((r) => r.json()),
    ]);
    setCategories(c);
    setLabels(l);
  }
  useEffect(() => { load(); }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color, budget: budget ? Number(budget) : 0 }),
    });
    setBusy(false);
    setName(""); setBudget("");
    load();
  }

  async function updateCategory(id: number, field: "budget" | "color", value: string) {
    const body = field === "budget" ? { budget: Number(value) || 0 } : { color: value };
    await fetch(`/api/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  async function delCategory(id: number) {
    if (!confirm("Delete category? Transactions will be uncategorized.")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  const inputCls = "w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories &amp; labels</h1>
        <p className="text-sm opacity-60">Organize spending. Set monthly budgets per category.</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-medium">Categories</h2>
        <form onSubmit={addCategory} className="flex flex-wrap gap-2 items-end">
          <label className="block">
            <span className="text-xs opacity-60">Name</span>
            <input className={inputCls + " w-40"} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs opacity-60">Color</span>
            <input type="color" className="h-9 w-12 rounded" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs opacity-60">Monthly budget</span>
            <input type="number" step="0.01" className={inputCls + " w-32"} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" />
          </label>
          <button disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">Add</button>
        </form>

        <ul className="grid sm:grid-cols-2 gap-3">
          {categories.map((c) => (
            <li key={c.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
              <div className="flex-1">
                <div className="font-medium text-sm">{c.name} <span className="opacity-50 text-xs">· {c._count.transactions}</span></div>
                <label className="flex items-center gap-1 text-xs opacity-70 mt-1">
                  Budget $
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={c.budget}
                    onBlur={(e) => updateCategory(c.id, "budget", e.target.value)}
                    className="w-20 rounded border border-black/15 dark:border-white/15 bg-transparent px-1 py-0.5"
                  />
                </label>
              </div>
              <button onClick={() => delCategory(c.id)} className="text-xs opacity-50 hover:text-red-500">delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Labels</h2>
        <LabelManager labels={labels} onChange={load} />
      </section>
    </div>
  );
}

function LabelManager({ labels, onChange }: { labels: Label[]; onChange: () => void }) {
  const [name, setName] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    setName("");
    onChange();
  }
  async function del(id: number) {
    if (!confirm("Delete label?")) return;
    await fetch(`/api/labels/${id}`, { method: "DELETE" });
    onChange();
  }
  const inputCls = "rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm";
  return (
    <>
      <form onSubmit={add} className="flex gap-2">
        <input className={inputCls + " w-48"} value={name} onChange={(e) => setName(e.target.value)} placeholder="Label name…" />
        <button className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm">Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {labels.map((l) => (
          <li key={l.id} className="inline-flex items-center gap-2 rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.name}
            <span className="text-xs opacity-50">{l._count.transactions}</span>
            <button onClick={() => del(l.id)} className="opacity-50 hover:text-red-500">×</button>
          </li>
        ))}
        {labels.length === 0 && <li className="text-sm opacity-50">No labels yet.</li>}
      </ul>
    </>
  );
}

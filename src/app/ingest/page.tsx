"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string; color: string };

export default function IngestPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "ocr" | "csv" | "email">("manual");
  const [inboundEmail, setInboundEmail] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
    fetch("/api/inbound-address")
      .then((r) => r.json())
      .then((d) => setInboundEmail(d.inboundEmail))
      .catch(() => {});
  }, []);

  // manual form state
  const [m, setM] = useState({
    merchant: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    categoryId: "",
    type: "expense",
    description: "",
    labels: "",
  });

  // ocr state
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<{ merchant: string; total?: number; date?: string; categorySuggestion?: string; lineItems?: { name: string; qty?: number; price?: number }[] } | null>(null);
  const [ocrSaved, setOcrSaved] = useState(false);

  // csv state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<{ imported: number; total: number; skippedRows: number[] } | null>(null);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const labels = m.labels.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: m.merchant,
        amount: Number(m.amount),
        date: m.date,
        type: m.type,
        description: m.description || null,
        categoryId: m.categoryId ? Number(m.categoryId) : null,
        labels,
        source: "manual",
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Transaction added." });
      setM({ ...m, merchant: "", amount: "", description: "", labels: "" });
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: j.error ?? "Failed to add." });
    }
  }

  async function runOcr(save: boolean) {
    if (!ocrFile) return;
    setBusy(true);
    setMsg(null);
    setOcrSaved(false);
    const form = new FormData();
    form.append("file", ocrFile);
    form.append("save", String(save));
    const res = await fetch("/api/ingest/ocr", { method: "POST", body: form });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "OCR failed." });
      return;
    }
    setOcrPreview(j.extracted);
    if (save) {
      setOcrSaved(true);
      setMsg({ ok: true, text: "Saved to transactions." });
      router.refresh();
    } else {
      setMsg({ ok: true, text: "Extracted — review then save." });
    }
  }

  async function runCsv() {
    if (!csvFile) return;
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.append("file", csvFile);
    const res = await fetch("/api/ingest/csv", { method: "POST", body: form });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "CSV import failed." });
      return;
    }
    setCsvResult(j);
    setMsg({ ok: true, text: `Imported ${j.imported} of ${j.total} rows.` });
    router.refresh();
  }

  const inputCls = "w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add bill / transaction</h1>
        <p className="text-sm opacity-60">Enter manually, scan a receipt/PDF with AI, or import a bank CSV.</p>
      </div>

      <div className="flex gap-1 border-b border-black/10 dark:border-white/10">
        {(["manual", "ocr", "csv", "email"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition ${
              tab === t ? "border-indigo-500 font-medium" : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {t === "ocr" ? "Scan receipt / PDF" : t === "csv" ? "Import CSV" : t === "email" ? "Email" : "Manual entry"}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`text-sm rounded-md px-3 py-2 ${msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      {tab === "manual" && (
        <form onSubmit={submitManual} className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <Field label="Merchant *">
            <input className={inputCls} value={m.merchant} onChange={(e) => setM({ ...m, merchant: e.target.value })} required />
          </Field>
          <Field label="Amount *">
            <input className={inputCls} type="number" step="0.01" value={m.amount} onChange={(e) => setM({ ...m, amount: e.target.value })} required />
          </Field>
          <Field label="Date">
            <input className={inputCls} type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={inputCls} value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>
          <Field label="Category">
            <select className={inputCls} value={m.categoryId} onChange={(e) => setM({ ...m, categoryId: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Labels (comma separated)">
            <input className={inputCls} value={m.labels} onChange={(e) => setM({ ...m, labels: e.target.value })} placeholder="Recurring, Impulse" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <input className={inputCls} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} />
            </Field>
          </div>
          <button disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "Saving…" : "Add transaction"}
          </button>
        </form>
      )}

      {tab === "ocr" && (
        <div className="space-y-4 max-w-2xl">
          <Field label="Receipt image or PDF">
            <input
              type="file"
              accept="image/*,application/pdf,.txt"
              className={inputCls}
              onChange={(e) => { setOcrFile(e.target.files?.[0] ?? null); setOcrPreview(null); setOcrSaved(false); }}
            />
          </Field>
          <div className="flex gap-2">
            <button disabled={!ocrFile || busy} onClick={() => runOcr(false)} className="rounded-md border border-black/15 dark:border-white/15 px-4 py-2 text-sm disabled:opacity-50">
              {busy ? "Working…" : "Extract (preview)"}
            </button>
            <button disabled={!ocrFile || busy} onClick={() => runOcr(true)} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
              Extract & save
            </button>
          </div>
          {ocrPreview && (
            <div className="rounded-md border border-black/10 dark:border-white/10 p-4 text-sm space-y-1">
              <div className="font-medium">{ocrPreview.merchant}</div>
              {ocrPreview.total != null && <div>Total: ${ocrPreview.total.toFixed(2)}</div>}
              {ocrPreview.date && <div>Date: {ocrPreview.date}</div>}
              {ocrPreview.categorySuggestion && <div>Suggested category: {ocrPreview.categorySuggestion}</div>}
              {ocrPreview.lineItems && ocrPreview.lineItems.length > 0 && (
                <ul className="mt-2 text-xs opacity-80 list-disc pl-4">
                  {ocrPreview.lineItems.map((li, i) => (
                    <li key={i}>{li.name}{li.price != null ? ` — $${li.price.toFixed(2)}` : ""}</li>
                  ))}
                </ul>
              )}
              {ocrSaved && <div className="text-emerald-600 text-xs mt-2">Saved to transactions.</div>}
            </div>
          )}
          <p className="text-xs opacity-50">Requires ANTHROPIC_API_KEY in .env. Without it, use manual entry or CSV.</p>
        </div>
      )}

      {tab === "csv" && (
        <div className="space-y-4 max-w-2xl">
          <Field label="Bank or spreadsheet CSV">
            <input type="file" accept=".csv,text/csv" className={inputCls} onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
          </Field>
          <button disabled={!csvFile || busy} onClick={runCsv} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "Importing…" : "Import"}
          </button>
          {csvResult && (
            <div className="text-sm rounded-md border border-black/10 dark:border-white/10 p-4">
              Imported {csvResult.imported} of {csvResult.total} rows.
              {csvResult.skippedRows.length > 0 && (
                <div className="text-xs opacity-60 mt-1">Skipped rows: {csvResult.skippedRows.join(", ")} (no amount found)</div>
              )}
            </div>
          )}
          <p className="text-xs opacity-50">
            Columns auto-detected: merchant/description/name/payee, amount/value/debit/credit, date, category.
          </p>
        </div>
      )}

      {tab === "email" && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-md border border-black/10 dark:border-white/10 p-4 text-sm space-y-2">
            <div className="font-medium">Forward receipts to your personal Billwise address:</div>
            {inboundEmail ? (
              <code className="block text-indigo-600 break-all">{inboundEmail}</code>
            ) : (
              <span className="opacity-60">Loading your address…</span>
            )}
            <p className="text-xs opacity-70">
              Any bill, invoice, or receipt sent to that address is auto-extracted with AI and added to your transactions — no photo, no CSV. Works with merchant receipts, utility ebills, subscription renewals, and warranty confirmations.
            </p>
            <p className="text-xs opacity-70">
              In your email app, set up <strong>auto-forwarding</strong> of receipts to this address (most email apps support rules/filters). Then every bill lands in Billwise on its own.
            </p>
          </div>
          <p className="text-xs opacity-50">
            Requires an inbound email service (Resend/Postmark Inbound) pointing its webhook at <code>/api/email/inbound</code> with <code>EMAIL_INBOUND_SECRET</code>. Without it, use manual entry, scan, or CSV.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs opacity-60">{label}</span>
      {children}
    </label>
  );
}

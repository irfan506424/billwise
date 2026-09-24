"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Insight = {
  title: string;
  body: string;
  category?: string | null;
  potentialSavings?: number | null;
  severity: "info" | "warning" | "alert";
};
type Rec = {
  id: number;
  title: string;
  body: string;
  category: string | null;
  potentialSavings: string | null;
  severity: string;
};
type Fee = {
  id: number;
  transactionId: number;
  type: string;
  merchant: string;
  reason: string;
  estimatedMonthly: string | null;
  transaction: { merchant: string; amount: string; date: string };
};
type Report = {
  id: number;
  month: string;
  headline: string;
  risks: string;
  recommendations: string;
  createdAt: string;
};
type Savings = {
  platformId: number;
  name: string;
  category: string;
  url: string;
  description: string;
  reason: string;
};

const severityStyle: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-600",
  warning: "bg-amber-500/15 text-amber-600",
  alert: "bg-red-500/15 text-red-600",
};

export default function ReviewPage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRecs() {
    const r = await fetch("/api/recommendations");
    setRecs(await r.json());
  }
  async function loadFees() {
    const r = await fetch("/api/hidden-fees");
    if (r.ok) setFees(await r.json());
  }
  async function loadReport() {
    const r = await fetch("/api/monthly-report");
    if (r.ok) setReport(await r.json());
  }
  async function loadSavings() {
    const r = await fetch("/api/savings/recommendations");
    if (r.ok) setSavings(await r.json());
  }
  useEffect(() => { loadRecs(); loadFees(); loadReport(); loadSavings(); }, []);

  async function runReview() {
    setBusy(true);
    setError(null);
    setInsights(null);
    setSummary(null);
    const res = await fetch("/api/ai/review", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Review failed.");
      return;
    }
    setInsights(j.insights);
    setSummary(j.summary);
    loadRecs();
  }

  async function scanHiddenFees() {
    setScanning(true);
    setError(null);
    const res = await fetch("/api/hidden-fees/scan", { method: "POST" });
    const j = await res.json();
    setScanning(false);
    if (!res.ok) {
      setError(j.error ?? "Scan failed.");
      return;
    }
    loadFees();
  }

  async function generateReport() {
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/cron/monthly-report", { method: "POST" });
    const j = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(j.error ?? "Report failed.");
      return;
    }
    loadReport();
  }

  async function dismissFee(id: number) {
    await fetch(`/api/hidden-fees/${id}`, { method: "PATCH" });
    loadFees();
  }

  async function dismiss(id: number) {
    await fetch(`/api/recommendations/${id}`, { method: "PATCH" });
    loadRecs();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI review</h1>
          <p className="text-sm opacity-60">Claude analyzes your transactions and recommends concrete savings.</p>
        </div>
        <button onClick={runReview} disabled={busy} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Analyzing…" : "Run AI review"}
        </button>
      </div>

      {error && (
        <div className="text-sm rounded-md px-3 py-2 bg-red-500/10 text-red-600">{error}</div>
      )}

      {insights && (
        <section className="space-y-3">
          <h2 className="font-medium">Latest insights</h2>
          {insights.length === 0 ? (
            <p className="text-sm opacity-60">No actionable insights found this round.</p>
          ) : (
            <ul className="space-y-3">
              {insights.map((i, idx) => (
                <li key={idx} className="rounded-lg border border-black/10 dark:border-white/10 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityStyle[i.severity] ?? severityStyle.info}`}>{i.severity}</span>
                    <span className="font-medium text-sm">{i.title}</span>
                    {i.potentialSavings != null && (
                      <span className="text-xs ml-auto text-emerald-600">Save ~{formatCurrency(i.potentialSavings)}</span>
                    )}
                  </div>
                  <p className="text-sm opacity-80">{i.body}</p>
                  {i.category && <span className="text-xs opacity-50">Category: {i.category}</span>}
                </li>
              ))}
            </ul>
          )}
          {summary && (
            <details className="text-xs opacity-60">
              <summary className="cursor-pointer">Analysis summary</summary>
              <pre className="whitespace-pre-wrap mt-2 font-mono">{summary}</pre>
            </details>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-medium">Hidden / sneaky fees</h2>
          <button onClick={scanHiddenFees} disabled={scanning} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-sm disabled:opacity-50">
            {scanning ? "Scanning…" : "Scan for hidden fees"}
          </button>
        </div>
        {fees.length === 0 ? (
          <p className="text-sm opacity-60">No sneaky charges detected yet. Run a scan.</p>
        ) : (
          <ul className="space-y-2">
            {fees.map((f) => (
              <li key={f.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600">{f.type}</span>
                    <span className="font-medium text-sm">{f.merchant}</span>
                    {f.estimatedMonthly && Number(f.estimatedMonthly) > 0 && (
                      <span className="text-xs ml-auto text-red-600">~{formatCurrency(Number(f.estimatedMonthly))}/mo</span>
                    )}
                  </div>
                  <p className="text-sm opacity-80 mt-1">{f.reason}</p>
                  <div className="text-xs opacity-50 mt-1">{f.transaction.merchant} · {formatCurrency(Number(f.transaction.amount))} · {new Date(f.transaction.date).toLocaleDateString()}</div>
                </div>
                <button onClick={() => dismissFee(f.id)} className="text-xs opacity-50 hover:opacity-100">dismiss</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-medium">Monthly financial-safety report</h2>
          <button onClick={generateReport} disabled={generating} className="rounded-md bg-black/5 dark:bg-white/10 px-3 py-2 text-sm disabled:opacity-50">
            {generating ? "Generating…" : "Generate this month"}
          </button>
        </div>
        {report ? (
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 space-y-2">
            <div className="font-medium text-sm">{report.headline}</div>
            {report.risks && JSON.parse(report.risks).length > 0 && (
              <div>
                <div className="text-xs opacity-60 mb-1">Risks:</div>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {JSON.parse(report.risks).map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            {report.recommendations && JSON.parse(report.recommendations).length > 0 && (
              <div className="mt-2">
                <div className="text-xs opacity-60 mb-1">Recommendations:</div>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {JSON.parse(report.recommendations).map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            <div className="text-xs opacity-50 mt-2">{report.month} · generated {new Date(report.createdAt).toLocaleString()}</div>
          </div>
        ) : (
          <p className="text-sm opacity-60">No report yet. Click <strong>Generate this month</strong>.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Save money — platforms matched to your spending</h2>
        {savings.length === 0 ? (
          <p className="text-sm opacity-60">No matches yet. Add categories to your transactions and recommendations will appear.</p>
        ) : (
          <ul className="space-y-2">
            {savings.map((s) => (
              <li key={s.platformId} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">{s.category}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-indigo-500 hover:underline">{s.name}</a>
                </div>
                <p className="text-sm opacity-80 mt-1">{s.description}</p>
                <p className="text-xs opacity-60 mt-1">{s.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Saved recommendations</h2>
        {recs.length === 0 ? (
          <p className="text-sm opacity-60">No recommendations saved yet. Run an AI review.</p>
        ) : (
          <ul className="space-y-2">
            {recs.map((r) => (
              <li key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityStyle[r.severity] ?? severityStyle.info}`}>{r.severity}</span>
                    <span className="font-medium text-sm">{r.title}</span>
                    {r.potentialSavings && Number(r.potentialSavings) > 0 && (
                      <span className="text-xs ml-auto text-emerald-600">~{formatCurrency(r.potentialSavings)}</span>
                    )}
                  </div>
                  <p className="text-sm opacity-80 mt-1">{r.body}</p>
                </div>
                <button onClick={() => dismiss(r.id)} className="text-xs opacity-50 hover:opacity-100">dismiss</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

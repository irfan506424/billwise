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

const severityStyle: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-600",
  warning: "bg-amber-500/15 text-amber-600",
  alert: "bg-red-500/15 text-red-600",
};

export default function ReviewPage() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRecs() {
    const r = await fetch("/api/recommendations");
    setRecs(await r.json());
  }
  useEffect(() => { loadRecs(); }, []);

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

"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

/* --------------------------------------------------------------------------
 * Line chart: spend vs earnings over time (2 series)
 * ------------------------------------------------------------------------ */
export type MonthlyPoint = { month: string; expense: number; income: number };

export function LineChart({ data }: { data: MonthlyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 280, P = { l: 48, r: 16, t: 16, b: 28 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(1, ...data.flatMap((d) => [d.expense, d.income]));
  const niceMax = niceCeil(max);
  const x = (i: number) => P.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => P.t + ih - (v / niceMax) * ih;
  const path = (key: "expense" | "income") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  return (
    <div className="viz-root">
      <Legend items={[{ label: "Spend", color: "var(--viz-expense)" }, { label: "Earnings", color: "var(--viz-income)" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Spend vs earnings over time">
        {/* gridlines + y ticks */}
        {ticks(niceMax, 4).map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--viz-gridline)" strokeWidth={1} />
            <text x={P.l - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--viz-text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {shortMoney(t)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--viz-text-muted)">{d.month}</text>
        ))}
        {/* series */}
        <path d={path("expense")} fill="none" stroke="var(--viz-expense)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={path("income")} fill="none" stroke="var(--viz-income)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={`e${i}`}>
            <circle cx={x(i)} cy={y(d.expense)} r={hover === i ? 5 : 3} fill="var(--viz-expense)" />
            <circle cx={x(i)} cy={y(d.income)} r={hover === i ? 5 : 3} fill="var(--viz-income)" />
          </g>
        ))}
        {/* hover layer */}
        <rect
          x={P.l} y={P.t} width={iw} height={ih} fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width * iw;
            const idx = Math.round((rel / iw) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, idx)));
          }}
          onMouseLeave={() => setHover(null)}
        />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={P.t + ih} stroke="var(--viz-axis)" strokeWidth={1} strokeDasharray="3 3" />
            <foreignObject x={Math.min(x(hover) + 8, W - 150)} y={P.t + 6} width={140} height={56}>
              <div className="text-xs rounded-md border border-black/10 dark:border-white/10 bg-[var(--viz-surface)] px-2 py-1 shadow">
                <div className="font-medium">{data[hover].month}</div>
                <div className="flex justify-between gap-3"><span style={{ color: "var(--viz-expense)" }}>Spend</span><span className="tabular-nums">{formatCurrency(data[hover].expense)}</span></div>
                <div className="flex justify-between gap-3"><span style={{ color: "var(--viz-income)" }}>Earn</span><span className="tabular-nums">{formatCurrency(data[hover].income)}</span></div>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Donut chart: spend by category
 * ------------------------------------------------------------------------ */
export type CategorySlice = { name: string; amount: number; colorIndex: number };

export function PieChart({ data }: { data: CategorySlice[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  const cx = 120, cy = 120, R = 100, r = 58;

  const arcs = data.map((d, i) => {
    const frac = d.amount / total;
    return { ...d, frac, color: `var(--cat-${d.colorIndex === -1 ? "other" : d.colorIndex + 1})` };
  });

  // Precompute cumulative start angles (plain loop, no reassign inside callbacks).
  const starts: number[] = [];
  let cur = -Math.PI / 2;
  for (const a of arcs) {
    starts.push(cur);
    cur += a.frac * Math.PI * 2;
  }
  const segments = arcs.map((a, i) => {
    const start = starts[i];
    const end = start + a.frac * Math.PI * 2;
    const large = a.frac > 0.5 ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const xi1 = cx + r * Math.cos(start), yi1 = cy + r * Math.sin(start);
    const xi2 = cx + r * Math.cos(end), yi2 = cy + r * Math.sin(end);
    const d = `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large} 0 ${xi1},${yi1} Z`;
    return { ...a, d, mid: (start + end) / 2 };
  });

  return (
    <div className="viz-root">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 240 240" className="w-56 h-56 shrink-0" role="img" aria-label="Spend by category">
          {segments.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill={s.color}
              stroke="var(--viz-surface)"
              strokeWidth={2}
              opacity={hover == null || hover === i ? 1 : 0.4}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill="var(--viz-text-muted)">Total spend</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--viz-text-primary)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(total)}
          </text>
        </svg>
        <div className="flex-1 space-y-1.5 text-sm">
          {arcs.map((a, i) => (
            <div key={i} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: a.color }} />
              <span className="flex-1 truncate">{a.name}</span>
              <span className="tabular-nums opacity-70">{Math.round((a.frac) * 100)}%</span>
              <span className="tabular-nums w-20 text-right">{formatCurrency(a.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setShowTable((v) => !v)} className="text-xs opacity-60 hover:opacity-100 mt-3">
        {showTable ? "Hide" : "Show"} table view
      </button>
      {showTable && (
        <table className="w-full text-sm mt-2">
          <thead><tr className="text-left text-xs opacity-60"><th className="py-1">Category</th><th className="text-right">Amount</th><th className="text-right">Share</th></tr></thead>
          <tbody>
            {arcs.map((a, i) => (
              <tr key={i} className="border-t border-black/5 dark:border-white/5">
                <td className="py-1"><span className="inline-block w-3 h-3 rounded-sm mr-2 align-middle" style={{ backgroundColor: a.color }} />{a.name}</td>
                <td className="text-right tabular-nums">{formatCurrency(a.amount)}</td>
                <td className="text-right tabular-nums opacity-70">{Math.round(a.frac * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Diverging bar chart: monthly net (income - spend)
 * ------------------------------------------------------------------------ */
export function BarChart({ data }: { data: { month: string; net: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, P = { l: 16, r: 16, t: 16, b: 28 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.net)));
  const nice = niceCeil(maxAbs);
  const midY = P.t + ih / 2;
  const bw = iw / data.length;
  const x = (i: number) => P.l + i * bw + bw * 0.2;
  const barW = bw * 0.6;
  const barY = (v: number) => (v >= 0 ? midY - (v / nice) * (ih / 2) : midY);
  const barH = (v: number) => Math.abs((v / nice) * (ih / 2));

  return (
    <div className="viz-root">
      <Legend items={[{ label: "Net positive", color: "var(--viz-income)" }, { label: "Net negative", color: "var(--viz-expense)" }]} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly net cash flow">
        <line x1={P.l} x2={W - P.r} y1={midY} y2={midY} stroke="var(--viz-axis)" strokeWidth={1} />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect
              x={x(i)} y={barY(d.net)} width={barW} height={Math.max(1, barH(d.net))}
              rx={4}
              fill={d.net >= 0 ? "var(--viz-income)" : "var(--viz-expense)"}
              opacity={hover == null || hover === i ? 1 : 0.5}
            />
            <text x={x(i) + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--viz-text-muted)">{d.month}</text>
          </g>
        ))}
        {hover != null && (
          <foreignObject x={Math.min(x(hover) + barW + 6, W - 130)} y={Math.max(P.t, barY(data[hover].net) - 40)} width={120} height={40}>
            <div className="text-xs rounded-md border border-black/10 dark:border-white/10 bg-[var(--viz-surface)] px-2 py-1 shadow">
              <div className="font-medium">{data[hover].month}</div>
              <div className="tabular-nums" style={{ color: data[hover].net >= 0 ? "var(--viz-income)" : "var(--viz-expense)" }}>
                {data[hover].net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(data[hover].net))}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex gap-4 text-xs mb-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: it.color }} />
          <span className="opacity-80">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function niceCeil(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
function ticks(max: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
}
function shortMoney(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(v)}`;
}

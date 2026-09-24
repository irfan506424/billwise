"use client";

import { useEffect, useState } from "react";

type Provider = "anthropic" | "openai" | "openrouter" | "ollama";

const PROVIDER_DEFAULTS: Record<Provider, { baseUrl: string; model: string; note: string }> = {
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5", note: "Get a key at console.anthropic.com → API Keys." },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o", note: "Get a key at platform.openai.com → API keys." },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-5", note: "Use any model via OpenRouter; key at openrouter.ai." },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.3", note: "Run `ollama serve` locally; free, no API cost." },
};

export default function AISettingsPage() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(PROVIDER_DEFAULTS.anthropic.baseUrl);
  const [model, setModel] = useState(PROVIDER_DEFAULTS.anthropic.model);
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/settings/ai");
    if (!res.ok) return;
    const d = await res.json();
    setProvider((d.provider ?? "anthropic") as Provider);
    setBaseUrl(d.baseUrl ?? PROVIDER_DEFAULTS[(d.provider ?? "anthropic") as Provider].baseUrl);
    setModel(d.model ?? PROVIDER_DEFAULTS[(d.provider ?? "anthropic") as Provider].model);
    setHasKey(!!d.hasKey);
    setApiKey(d.hasKey ? "•••••••••••••" : "");
  }

  useEffect(() => {
    load();
  }, []);

  function pickProvider(p: Provider) {
    setProvider(p);
    setBaseUrl(PROVIDER_DEFAULTS[p].baseUrl);
    setModel(PROVIDER_DEFAULTS[p].model);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, baseUrl, model }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: j.error ?? "Save failed" });
      return;
    }
    setMsg({ ok: true, text: "AI settings saved." });
    setHasKey(true);
    setApiKey("••••••••••••••");
  }

  const inputCls = "w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="text-sm opacity-60">
          Bring your own key — AI review & receipt OCR run on your provider, at your cost. No provider cost to Billwise.
        </p>
      </div>

      {msg && (
        <div className={`text-sm rounded-md px-3 py-2 ${msg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-4">
        <label className="block">
          <span className="text-xs opacity-60">Provider</span>
          <select className={inputCls} value={provider} onChange={(e) => pickProvider(e.target.value as Provider)}>
            {(Object.keys(PROVIDER_DEFAULTS) as Provider[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs opacity-60">API key {hasKey && "(saved — paste to replace)"}</span>
          <input
            type="password"
            className={inputCls}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "••••••••••••••" : "paste your key"}
          />
        </label>

        <label className="block">
          <span className="text-xs opacity-60">Base URL</span>
          <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>

        <label className="block">
          <span className="text-xs opacity-60">Model</span>
          <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} />
        </label>

        <button onClick={save} disabled={busy || !apiKey} className="rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Saving…" : "Save AI settings"}
        </button>
      </div>

      <p className="text-xs opacity-50">
        {PROVIDER_DEFAULTS[provider].note} Without a key here or <code>ANTHROPIC_API_KEY</code> on the server, AI review and receipt OCR show a “set a key” message; the rules engine and charts work regardless.
      </p>
    </div>
  );
}

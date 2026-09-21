"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(j.error ?? "Registration failed");
      return;
    }
    const s = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setBusy(false);
    if (s?.error) {
      setError("Account created — please sign in.");
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const cls = "w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

  return (
    <div className="max-w-sm mx-auto w-full py-16">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Create account</h1>
      <p className="text-sm opacity-60 mb-6">Start tracking bills and savings.</p>
      <form onSubmit={submit} className="space-y-3">
        <input placeholder="Name (optional)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cls} />
        <input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={cls} />
        <input type="password" required placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={cls} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={busy} className="w-full rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="text-sm opacity-60 mt-4">
        Have an account? <Link href="/login" className="text-indigo-500 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

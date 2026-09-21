"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto w-full py-16">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Welcome back</h1>
      <p className="text-sm opacity-60 mb-6">Sign in to your Billwise account.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={busy} className="w-full rounded-md bg-indigo-500 text-white px-4 py-2 text-sm disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm opacity-60 mt-4">
        No account? <Link href="/register" className="text-indigo-500 hover:underline">Register</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto py-16 text-sm opacity-60">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

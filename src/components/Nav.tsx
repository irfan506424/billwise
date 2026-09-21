"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/ingest", label: "Add bill" },
  { href: "/categories", label: "Categories" },
  { href: "/rules", label: "Rules" },
  { href: "/review", label: "AI review" },
];

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <header className="w-full border-b border-black/10 dark:border-white/10 sticky top-0 bg-[var(--background)]/80 backdrop-blur z-10">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-1">
        <Link href="/" className="font-semibold mr-4 tracking-tight">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 align-middle" />
          Billwise
        </Link>
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                active
                  ? "bg-black/10 dark:bg-white/15 font-medium"
                  : "hover:bg-black/5 dark:hover:bg-white/10 opacity-80 hover:opacity-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {status === "authenticated" && session?.user ? (
            <>
              <span className="opacity-60 text-xs hidden sm:inline">{session.user.email}</span>
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="opacity-70 hover:opacity-100">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="opacity-70 hover:opacity-100">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}

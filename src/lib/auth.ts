import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit } from "./rateLimit";
import { logger } from "./logger";

const secure = process.env.NODE_ENV === "production";

// Hardened cookie config: __Secure- prefix, HttpOnly, SameSite=Lax, Secure in prod.
// In dev (http) we keep the default names without Secure so login still works.
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure,
};

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Trust the host header — required when deployed behind a proxy/Vercel.
  trustHost: true,
  useSecureCookies: secure,
  cookies: secure
    ? {
        sessionToken: { name: `__Secure-next-auth.session-token`, options: cookieOptions },
        callbackUrl: { name: `__Secure-next-auth.callback-url`, options: cookieOptions },
        csrfToken: { name: `__Secure-next-auth.csrf-token`, options: cookieOptions },
        pkceCodeVerifier: { name: `__Secure-next-auth.pkce.code-verifier`, options: cookieOptions },
      }
    : undefined,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        // Rate limit per-account to slow credential stuffing.
        // (Per-IP limiting belongs in the proxy / a Redis-backed limiter in production.)
        if (!rateLimit(`login:${email}`, { windowMs: 60_000, max: 10 })) {
          logger.warn({ event: "login.rate_limited", email });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/** Returns the authenticated user's id, or null. Works in Route Handlers and Server Components. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

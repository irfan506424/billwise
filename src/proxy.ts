import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_API = ["/api/auth", "/api/register", "/api/cron", "/api/plaid/webhook", "/api/stripe/webhook"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  // allow auth API + register API
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return;

  if (!isAuthed) {
    // let unauthed users reach the public login/register pages
    if (PUBLIC_PATHS.includes(pathname)) return;
    if (pathname.startsWith("/api")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  // authed users visiting login/register are sent to the dashboard
  if (PUBLIC_PATHS.includes(pathname)) {
    return Response.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

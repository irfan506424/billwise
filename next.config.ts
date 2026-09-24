import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  // Next inline scripts/hydration + Plaid Link script
  "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
  // Tailwind + Next injected styles
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.stripe.com https://*.supabase.co",
  // browser fetches same-origin API + Supabase/Plaid/Stripe
  "connect-src 'self' https://*.supabase.co https://*.plaid.com https://api.stripe.com wss://*.supabase.co",
  // Stripe Checkout is a redirect; allow it for form posts + any iframe usage
  "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
  "frame-src 'self' https://*.stripe.com https://js.stripe.com",
  "font-src 'self' data:",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;

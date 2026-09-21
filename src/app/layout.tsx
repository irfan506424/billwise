import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billwise — smart bill & spend tracker",
  description: "Digitized bill system with categories, labels, AI review, and savings rules.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <Nav />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">{children}</main>
          <footer className="text-center text-xs opacity-50 py-6">Billwise · local-first</footer>
        </Providers>
      </body>
    </html>
  );
}

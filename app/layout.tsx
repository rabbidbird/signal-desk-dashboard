import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "Signal Desk · Paper Trading Dashboard",
    description: "A clear, safety-first view of paper positions, performance, activity, and trading guardrails.",
    openGraph: {
      title: "Signal Desk",
      description: "Your paper trading account, positions, and risk controls at a glance.",
      images: [{ url: image, width: 1731, height: 909, alt: "Signal Desk paper trading dashboard" }],
    },
    twitter: { card: "summary_large_image", title: "Signal Desk", description: "Paper trades and risk controls at a glance.", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

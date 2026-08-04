import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-operations.png`;
  return {
    title: "Signal Desk · Trading Operations Dashboard",
    description: "A private, safety-first view of trade proposals, approvals, positions, activity, and emergency controls.",
    openGraph: {
      title: "Signal Desk",
      description: "Trade approvals, account state, and emergency controls at a glance.",
      images: [{ url: image, width: 1731, height: 909, alt: "Signal Desk paper trading dashboard" }],
    },
    twitter: { card: "summary_large_image", title: "Signal Desk", description: "Trade approvals and risk controls at a glance.", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

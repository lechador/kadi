import type { Metadata } from "next";
import { headers } from "next/headers";

import Providers from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const metadataBase = host ? new URL(`${protocol}://${host}`) : new URL("http://localhost:3000");

  return {
    metadataBase,
    title: "Kadi — donations that reach creators whole",
    description:
      "Non-custodial creator donations on Solana. Keep 97.5%, settle instantly, and verify every contribution on-chain.",
    openGraph: {
      title: "Kadi — donations that reach creators whole",
      description: "Non-custodial. Instant. On-chain.",
      images: [{ url: "/og.png", width: 1731, height: 909, alt: "Kadi creator donations" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kadi — donations that reach creators whole",
      description: "Non-custodial. Instant. On-chain.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

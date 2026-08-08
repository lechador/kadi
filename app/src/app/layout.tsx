import type { Metadata, Viewport } from "next";

import { APP_URL } from "@/lib/config";
import Providers from "./providers";
import "./globals.css";

/// `metadataBase` comes from the configured origin rather than the request
/// headers on purpose: reading headers here would opt every route in the app
/// into dynamic rendering, and the landing page is meant to be cached. The
/// same value already builds Solana Pay links and overlay URLs, so a wrong one
/// would be obvious long before it reached a share card.
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Kadi — დონაციები, რომლებიც სრულად აღწევს კრეატორამდე",
    template: "%s",
  },
  description:
    "არაკასტოდიული დონაციები კრეატორებისთვის Solana-ზე. დაიტოვეთ 97.5%, მიიღეთ თანხა მყისიერად და გადაამოწმეთ ყველა დონაცია ბლოკჩეინზე.",
  applicationName: "Kadi",
  openGraph: {
    siteName: "Kadi",
    title: "Kadi — დონაციები კრეატორებისთვის",
    description: "არაკასტოდიული. მყისიერი. ბლოკჩეინზე.",
    locale: "ka_GE",
    type: "website",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Kadi — დონაციები კრეატორებისთვის",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kadi — დონაციები კრეატორებისთვის",
    description: "არაკასტოდიული. მყისიერი. ბლოკჩეინზე.",
    images: ["/api/og"],
  },
  icons: { icon: "/icon.svg" },
};

/// Paints the mobile browser chrome to match the page, so the surface does not
/// stop at the top of the viewport. Lives on `viewport` rather than `metadata`
/// — Next moved it there, and setting it on `metadata` is silently ignored.
export const viewport: Viewport = {
  themeColor: "#08080f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ka">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

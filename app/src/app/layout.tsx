import type { Metadata } from "next";

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
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Kadi — დონაციები კრეატორებისთვის",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kadi — დონაციები კრეატორებისთვის",
    description: "არაკასტოდიული. მყისიერი. ბლოკჩეინზე.",
    images: ["/og.png"],
  },
  icons: { icon: "/icon.svg" },
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

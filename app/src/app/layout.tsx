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
    title: "Kadi — დონაციები, რომლებიც სრულად აღწევს კრეატორამდე",
    description:
      "არაკასტოდიული დონაციები კრეატორებისთვის Solana-ზე. დაიტოვეთ 97.5%, მიიღეთ თანხა მყისიერად და გადაამოწმეთ ყველა დონაცია ბლოკჩეინზე.",
    openGraph: {
      title: "Kadi — დონაციები კრეატორებისთვის",
      description: "არაკასტოდიული. მყისიერი. ბლოკჩეინზე.",
      locale: "ka_GE",
      images: [{ url: "/og.png", width: 1731, height: 909, alt: "Kadi — დონაციები კრეატორებისთვის" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kadi — დონაციები კრეატორებისთვის",
      description: "არაკასტოდიული. მყისიერი. ბლოკჩეინზე.",
      images: ["/og.png"],
    },
  };
}

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

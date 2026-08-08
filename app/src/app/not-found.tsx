"use client";

import Link from "next/link";

import { Nav } from "@/components/Nav";
import { useLanguage } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-5 py-28 sm:px-8">
        <p className="eyebrow text-grape-400">404</p>
        <h1 className="display mt-5 text-6xl leading-none">
          {t("nothingHere")}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-mist-500">
          {t("notFoundBody")}
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/"
            className="btn-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            {t("browseGoals")}
          </Link>
          <Link
            href="/dashboard"
            className="btn-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            {t("creatorStudio")}
          </Link>
        </div>
      </main>
    </>
  );
}

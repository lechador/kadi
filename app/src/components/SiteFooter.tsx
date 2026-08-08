"use client";

import Link from "next/link";

import { useLanguage } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-black/20 bg-ink-850">
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-9 sm:px-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="display text-2xl leading-none">Kadi — ნაკადი</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-mist-600">
            {t("footerBody")}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600 md:justify-end">
          <Link href="/explore" className="hover:text-grape-400">
            {t("browse")}
          </Link>
          <Link href="/activity" className="hover:text-grape-400">
            {t("activity")}
          </Link>
          <Link href="/dashboard" className="hover:text-grape-400">
            {t("forCreators")}
          </Link>
          <a
            href="https://github.com/lechador/kadi"
            target="_blank"
            rel="noreferrer"
            className="hover:text-grape-400"
          >
            GitHub
          </a>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl border-t border-black/20 px-5 py-4 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600 sm:px-8">
        {t("footer")}
      </div>
    </footer>
  );
}

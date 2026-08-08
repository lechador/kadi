"use client";

import Link from "next/link";

import { BRAND } from "@/lib/config";
import { useLanguage } from "@/lib/i18n";
import { WalletButton } from "./WalletButton";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-baseline gap-3 ${className}`}>
      <span className="display text-[2rem] leading-none tracking-[-0.08em]">
        {BRAND.name}
      </span>
      <span className="hidden font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-mist-500 sm:inline">
        ნაკადი / flow
      </span>
    </span>
  );
}

export function Nav() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="transition-opacity hover:opacity-60">
          <Logo />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/explore"
            className="hidden px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400 sm:block"
          >
            {t("explore")}
          </Link>
          <Link
            href="/activity"
            className="hidden px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400 sm:block"
          >
            {t("activity")}
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400"
          >
            {t("forCreators")}
          </Link>
          <button
            type="button"
            onClick={() => setLanguage(language === "ka" ? "en" : "ka")}
            aria-label={language === "ka" ? "Switch to English" : "ქართულად გადართვა"}
            className="px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400"
          >
            {language === "ka" ? "EN" : "ქარ"}
          </button>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}

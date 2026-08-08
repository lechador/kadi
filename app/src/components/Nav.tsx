import Link from "next/link";

import { BRAND } from "@/lib/config";
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
  return (
    <header className="sticky top-0 z-40 border-b border-black/20 bg-ink-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="transition-opacity hover:opacity-60">
          <Logo />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/#goals"
            className="hidden px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400 sm:block"
          >
            Browse
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:text-grape-400"
          >
            For creators
          </Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}

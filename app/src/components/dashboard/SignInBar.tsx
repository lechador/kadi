"use client";

import { shortAddress } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/// The gate in front of everything off-chain.
///
/// Worth being explicit about what it is not: none of a creator's money moves
/// through this. Claiming funds, creating goals and editing the on-chain
/// profile are all transactions the wallet signs and the program authorises.
/// This session only decides who may change a banner image.
export function SignInBar() {
  const { t } = useLanguage();
  const { address, matchesWallet, loading, signingIn, error, signIn, signOut } =
    useSession();

  if (loading) return null;

  if (address && matchesWallet) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border border-black/20 bg-ink-900 px-4 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
          {t("signedInAs", { address: shortAddress(address, 4) })}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-[10px] font-bold uppercase tracking-[0.08em] text-mist-500 hover:text-grape-400"
        >
          {t("signOut")}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-black/25 bg-ink-900 px-4 py-4">
      <p className="text-xs leading-relaxed text-mist-500">
        {address && !matchesWallet ? t("walletChanged") : t("signInToEdit")}
      </p>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={signingIn}
        className="btn-secondary mt-3 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em]"
      >
        {signingIn ? t("signingIn") : t("signIn")}
      </button>
      {error && (
        <p className="mt-2 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

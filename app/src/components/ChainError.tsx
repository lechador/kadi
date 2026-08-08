"use client";

import { CHAIN, RPC_URL } from "@/lib/config";
import { useLanguage } from "@/lib/i18n";

/// Shown when the RPC endpoint cannot be reached. The most common cause during
/// local development is simply that no validator is running, so the fix is
/// spelled out rather than left as a stack trace.
export function ChainError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  const { t } = useLanguage();
  const localnet = CHAIN.endsWith("localnet");

  return (
    <div className="border-l-4 border-ember-400 bg-ink-850 p-6">
      <p className="eyebrow text-ember-400">{t("chainUnavailable")}</p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist-500">
        {t("chainUnavailableBody")}
      </p>

      <p className="mt-4 font-mono text-xs text-mist-600">
        {t("endpoint")}: {RPC_URL}
      </p>

      {localnet && (
        <div className="mt-4 border-t border-black/15 pt-4">
          <p className="text-sm text-mist-500">
            {t("localValidator")}
          </p>
          <code className="mt-2 block bg-ink-950 px-3 py-2 font-mono text-xs text-mist-300">
            npm run localnet
          </code>
          <p className="mt-2 text-xs text-mist-600">
            {t("thenRun")} <span className="font-mono">npm run deploy:localnet</span> /{" "}
            <span className="font-mono">npm run seed</span>.
          </p>
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
          {t("details")}
        </summary>
        <p className="mt-2 font-mono text-xs leading-relaxed text-mist-600">
          {error.message}
        </p>
      </details>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary mt-5 px-4 py-2 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

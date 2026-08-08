"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-28 sm:px-8">
      <p className="eyebrow text-ember-400">{t("somethingBroke")}</p>
      <h1 className="display mt-5 text-6xl leading-none">
        {t("didNotWork")}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-mist-500">
        {t("errorBody")}
      </p>

      <p className="mt-4 font-mono text-xs leading-relaxed text-mist-600">
        {error.message}
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="btn-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
        >
          {t("tryAgain")}
        </button>
        <Link
          href="/"
          className="btn-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
        >
          {t("goHome")}
        </Link>
      </div>
    </main>
  );
}

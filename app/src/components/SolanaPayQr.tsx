"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { APP_URL } from "@/lib/config";
import { useLanguage } from "@/lib/i18n";

/// Builds a Solana Pay *transaction request* URL. The wallet fetches the inner
/// HTTPS endpoint, which returns a fully-formed donation transaction — so a
/// phone scan produces the same on-chain instruction as the desktop flow,
/// including the fee split and supporter bookkeeping.
///
/// The amount and message travel as query parameters on that endpoint, so the
/// QR encodes exactly what the donor typed rather than a default.
export function solanaPayUrl(
  handle: string,
  index: bigint | number,
  options: { amount?: string; message?: string } = {}
): string {
  const endpoint = new URL(`${APP_URL}/api/pay/${handle}/${index}`);
  if (options.amount) endpoint.searchParams.set("amount", options.amount);
  if (options.message) endpoint.searchParams.set("message", options.message);
  return `solana:${encodeURIComponent(endpoint.toString())}`;
}

export function SolanaPayQr({
  handle,
  index,
  amount,
  message,
  symbol = "SOL",
  size = 208,
}: {
  handle: string;
  index: bigint | number;
  amount?: string;
  message?: string;
  symbol?: string;
  size?: number;
}) {
  const { t } = useLanguage();
  const [dataUrl, setDataUrl] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(solanaPayUrl(handle, index, { amount, message }), {
      width: size * 2,
      margin: 1,
      color: { dark: "#171714", light: "#faf7f0" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : t("qrFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [handle, index, amount, message, size, t]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center overflow-hidden border border-black/25 bg-ink-850 p-2"
        style={{ width: size, height: size }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={t("qrAlt")}
            className="h-full w-full"
          />
        ) : (
          <span className="text-xs text-mist-600">
            {error ?? t("generating")}
          </span>
        )}
      </div>
      <p className="max-w-[15rem] text-center text-xs leading-relaxed text-mist-600">
        {amount ? (
          <>
            {t("qrAmount", { amount, symbol })}
          </>
        ) : (
          <>{t("qrAny")}</>
        )}
      </p>
    </div>
  );
}

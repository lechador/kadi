"use client";

import { useEffect, useRef, useState } from "react";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
} from "@solana/kit-plugin-wallet/react";

import { useKadiClient } from "@/lib/hooks";
import { shortAddress } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

export function WalletButton() {
  const { t } = useLanguage();
  const client = useKadiClient();
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);

  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const address = connected ? String(connected.account.address) : null;
  const failure = (connect.error ?? disconnect.error) as Error | undefined;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          address
            ? "border border-rule bg-ink-850 px-4 py-2 font-mono text-xs font-bold text-mist-100 hover:border-rule-solid"
            : "btn-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.06em]"
        }
      >
        {address ? (
          <span className="font-mono">{shortAddress(address)}</span>
        ) : (
          t("connectWallet")
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 z-50 mt-2 w-64 border-rule-strong p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)]"
        >
          {connected ? (
            <button
              type="button"
              onClick={() => {
                void disconnect.dispatch();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-mist-300 hover:bg-ink-900"
            >
              {t("disconnect")}
            </button>
          ) : wallets.length === 0 ? (
            <p className="px-3 py-3 text-sm text-mist-500">
              {t("noWallet")}
            </p>
          ) : (
            wallets.map((wallet) => (
              <button
                key={wallet.name}
                type="button"
                onClick={() => {
                  void connect.dispatch(wallet);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-mist-100 hover:bg-ink-900"
              >
                {typeof wallet.icon === "string" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={wallet.icon} alt="" className="h-5 w-5 rounded" />
                )}
                {wallet.name}
              </button>
            ))
          )}

          {failure && (
            <p className="px-3 pt-2 text-xs text-ember-400">
              {failure.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

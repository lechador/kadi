"use client";

import { useMemo, useState } from "react";
import type { Address } from "@solana/kit";

import { donateSol, donateToken } from "@/lib/actions";
import { explorerTx } from "@/lib/config";
import { formatTokenAmount, parseTokenAmount } from "@/lib/format";
import { useAsync, useKadiClient, useWallet } from "@/lib/hooks";
import { fetchTokenBalance, type KadiRpc } from "@/lib/queries";
import { isNativeMint, tokenFor } from "@/lib/tokens";
import { SolanaPayQr } from "./SolanaPayQr";

const SOL_PRESETS = ["0.1", "0.5", "1", "5"];
const TOKEN_PRESETS = ["5", "10", "25", "100"];
const MAX_MESSAGE = 200; // must match MAX_MESSAGE_LEN in the program

export function DonatePanel({
  goalAddress,
  mint,
  treasury,
  feeBps,
  handle,
  index,
  disabled = false,
  onDonated,
}: {
  goalAddress: Address;
  mint: Address;
  treasury: Address;
  feeBps: number;
  handle: string;
  index: bigint;
  disabled?: boolean;
  onDonated?: () => void;
}) {
  const client = useKadiClient();
  const connected = useWallet();
  const rpc = client.rpc as unknown as KadiRpc;

  const token = tokenFor(mint);
  const native = isNativeMint(mint);
  const presets = native ? SOL_PRESETS : TOKEN_PRESETS;

  const [amount, setAmount] = useState(presets[1]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [signature, setSignature] = useState<string>();
  const [error, setError] = useState<string>();
  const [showQr, setShowQr] = useState(false);

  // Token goals can silently fail in the wallet if the donor holds none of the
  // mint, so the balance is surfaced before they try.
  const balance = useAsync(async () => {
    if (native || !connected?.account) return null;
    return fetchTokenBalance(rpc, connected.account.address as Address, mint);
  }, [client, connected?.account?.address, mint, native, signature]);

  const base = useMemo(
    () => parseTokenAmount(amount, token.decimals),
    [amount, token.decimals]
  );

  const split = useMemo(() => {
    if (base === null || base <= 0n) return null;
    const fee = (base * BigInt(feeBps)) / 10_000n;
    return { fee, net: base - fee };
  }, [base, feeBps]);

  const insufficient =
    !native && balance.data != null && base !== null && base > balance.data;

  const canSend =
    !disabled &&
    !sending &&
    !!connected?.signer &&
    base !== null &&
    base > 0n &&
    !insufficient &&
    message.length <= MAX_MESSAGE;

  async function send() {
    if (!connected?.signer || base === null) return;

    setSending(true);
    setError(undefined);
    setSignature(undefined);

    try {
      const instruction = native
        ? await donateSol({
            goal: goalAddress,
            treasury,
            donor: connected.signer,
            amount: base,
            message,
          })
        : await donateToken({
            goal: goalAddress,
            treasury,
            mint,
            donor: connected.signer,
            amount: base,
            message,
          });

      const result = await client.sendTransaction([instruction]);
      setSignature(result.context.signature);
      setMessage("");
      onDonated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Donation failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card border-black/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Support this goal</h3>
        <button
          type="button"
          onClick={() => setShowQr((value) => !value)}
          className="border-b border-black/30 px-1 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:border-grape-400 hover:text-grape-400"
        >
          {showQr ? "Use wallet" : "Scan QR"}
        </button>
      </div>

      {showQr ? (
        <div className="py-2">
          {native ? (
            <SolanaPayQr
              handle={handle}
              index={index}
              amount={base !== null && base > 0n ? amount : undefined}
              message={message || undefined}
              symbol={token.symbol}
            />
          ) : (
            <p className="px-2 py-6 text-center text-xs leading-relaxed text-mist-600">
              Solana Pay QR is available for SOL goals. Donate to this{" "}
              {token.symbol} goal with a connected wallet.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`flex-1 border px-2 py-2 font-mono text-xs font-bold transition-colors ${
                  amount === preset
                    ? "border-grape-500 bg-grape-500 text-white"
                    : "border-black/20 text-mist-500 hover:border-black hover:text-mist-100"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-mist-500">
            <span>Amount ({token.symbol})</span>
            {balance.data != null && (
              <span className="font-mono text-mist-600">
                balance {formatTokenAmount(balance.data, token.decimals)}
              </span>
            )}
          </label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="field mb-3 w-full px-3 py-2.5 text-sm"
            placeholder={presets[1]}
          />

          <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-mist-500">
            <span>Message (shown on stream)</span>
            <span
              className={
                message.length > MAX_MESSAGE
                  ? "text-ember-400"
                  : "text-mist-600"
              }
            >
              {message.length}/{MAX_MESSAGE}
            </span>
          </label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            className="field mb-3 w-full resize-none px-3 py-2.5 text-sm"
            placeholder="გამარჯობა! Keep it up 🇬🇪"
          />

          {split && (
            <div className="mb-4 space-y-1 border-y border-black/20 bg-ink-900 px-3 py-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-mist-500">Creator receives</span>
                <span className="font-medium text-mint-300">
                  {formatTokenAmount(split.net, token.decimals)} {token.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist-500">
                  Protocol fee ({(feeBps / 100).toFixed(2)}%)
                </span>
                <span className="text-mist-500">
                  {formatTokenAmount(split.fee, token.decimals)} {token.symbol}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="btn-primary w-full px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            {sending
              ? "Confirming…"
              : !connected?.signer
                ? "Connect a wallet to donate"
                : disabled
                  ? "Not accepting donations"
                  : insufficient
                    ? `Not enough ${token.symbol}`
                    : "Donate"}
          </button>
        </>
      )}

      {signature && (
        <p className="mt-3 text-center text-xs text-mint-300">
          Donation confirmed ·{" "}
          <a
            href={explorerTx(signature)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            view transaction
          </a>
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

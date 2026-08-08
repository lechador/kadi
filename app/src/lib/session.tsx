"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useKadiClient, useWallet } from "./hooks";

/// Wallet sign-in, for the off-chain half of the app.
///
/// Donating, claiming and every other instruction needs no session at all —
/// the wallet signs those transactions and the program checks them. This is
/// only what lets the server accept a banner image or an overlay colour and
/// know whose it is.

type SessionValue = {
  /// The wallet this browser has proven control of, or null.
  address: string | null;
  /// True when the signed-in wallet is also the one currently connected.
  /// A creator who switches accounts in their wallet extension is no longer
  /// authorised for the previous one, and the UI has to say so.
  matchesWallet: boolean;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const client = useKadiClient();
  const connected = useWallet();
  const walletAddress = connected ? String(connected.account.address) : null;

  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((body: { address: string | null }) => {
        if (live) setAddress(body.address);
      })
      .catch(() => {
        if (live) setAddress(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!walletAddress) {
      setError("Connect a wallet first");
      return false;
    }

    setSigningIn(true);
    setError(null);
    try {
      const challenge = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      });
      if (!challenge.ok) {
        throw new Error(await readError(challenge, "Could not start sign-in"));
      }
      const { message } = (await challenge.json()) as { message: string };

      // Goes through the wallet's `solana:signMessage` feature, so wallets that
      // cannot sign transactions at all can still sign in.
      const signature = await client.wallet.signMessage(
        new TextEncoder().encode(message)
      );

      const verified = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          message,
          signature: toBase64(new Uint8Array(signature)),
        }),
      });
      if (!verified.ok) {
        throw new Error(await readError(verified, "Sign-in failed"));
      }

      const body = (await verified.json()) as { address: string };
      setAddress(body.address);
      return true;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [client, walletAddress]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
    setAddress(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      address,
      matchesWallet: address !== null && address === walletAddress,
      loading,
      signingIn,
      error,
      signIn,
      signOut,
    }),
    [address, walletAddress, loading, signingIn, error, signIn, signOut]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

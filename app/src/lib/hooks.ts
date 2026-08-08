"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClient } from "@solana/react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";

import type { AppClient } from "@/app/providers";

export function useKadiClient(): AppClient {
  return useClient<AppClient>();
}

export function useWallet() {
  const client = useKadiClient();
  return useConnectedWallet(client);
}

export type Async<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
};

/// Small async-data hook. Deliberately not a cache: every page here reads
/// straight from chain, and a stale donation total is worse than a spinner.
export function useAsync<T>(
  load: () => Promise<T>,
  deps: React.DependencyList
): Async<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // Guards against a slow earlier request resolving after a newer one and
  // overwriting fresher data.
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);

    load()
      .then((value) => {
        if (generation.current !== current) return;
        setData(value);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (generation.current !== current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (generation.current !== current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

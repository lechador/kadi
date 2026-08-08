"use client";

import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { ClientProvider } from "@solana/react";

import { CHAIN, RPC_URL, WS_URL } from "@/lib/config";
import { LanguageProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";

export const client = createClient()
  .use(walletSigner({ chain: CHAIN }))
  .use(solanaRpc({ rpcUrl: RPC_URL, rpcSubscriptionsUrl: WS_URL }));

export type AppClient = Awaited<typeof client>;

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <ClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </ClientProvider>
    </LanguageProvider>
  );
}

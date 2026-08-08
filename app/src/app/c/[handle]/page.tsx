"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ChainError } from "@/components/ChainError";
import { GoalCard } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { GoalStatus } from "@/generated";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { SOL_TOKEN, tokenFor } from "@/lib/tokens";
import { useAsync, useKadiClient } from "@/lib/hooks";
import { fetchCreatorByHandle, fetchCreatorGoals } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";

export default function CreatorPage() {
  const { t } = useLanguage();
  const params = useParams<{ handle: string }>();
  const handle = params.handle;
  const client = useKadiClient();

  const creator = useAsync(
    () => fetchCreatorByHandle(client.rpc, handle),
    [client, handle]
  );

  const goals = useAsync(async () => {
    if (!creator.data) return [];
    return fetchCreatorGoals(
      client.rpc,
      creator.data.address,
      creator.data.data.goalCount
    );
  }, [client, creator.data]);

  const active = (goals.data ?? []).filter(
    (goal) => goal.data.status === GoalStatus.Active
  );
  const past = (goals.data ?? []).filter(
    (goal) => goal.data.status !== GoalStatus.Active
  );
  // Totals are kept per denomination — adding lamports to USDC base units
  // would produce a number that means nothing.
  const totals = (() => {
    const byMint = new Map<string, bigint>();
    for (const goal of goals.data ?? []) {
      byMint.set(
        goal.data.mint,
        (byMint.get(goal.data.mint) ?? 0n) + goal.data.raised
      );
    }
    return [...byMint.entries()]
      .map(([mint, raised]) => ({ token: tokenFor(mint), raised }))
      .filter((entry) => entry.raised > 0n)
      .sort((a, b) => (a.token.symbol === "SOL" ? -1 : b.token.symbol === "SOL" ? 1 : 0));
  })();

  const headline = totals[0] ?? { token: SOL_TOKEN, raised: 0n };

  if (creator.loading) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="h-56 animate-pulse border-y border-black/20 bg-ink-850" />
        </main>
      </>
    );
  }

  // An unreachable RPC is not the same as an unregistered handle, and telling
  // a creator their page does not exist because the node is down would be a lie.
  if (creator.error) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <ChainError error={creator.error} onRetry={creator.reload} />
        </main>
      </>
    );
  }

  if (!creator.data) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-grape-400">{t("creator404")}</p>
          <h1 className="display mt-5 text-6xl">{t("noCreator", { handle })}</h1>
          <p className="mt-4 text-sm text-mist-500">{t("handleAvailable")}</p>
          <Link
            href="/dashboard"
            className="btn-primary mt-8 inline-block px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            {t("claimIt")}
          </Link>
        </main>
      </>
    );
  }

  const profile = creator.data.data;

  return (
    <>
      <Nav />

      <main>
        <section className="border-b border-black/20 bg-ink-850">
          <div className="mx-auto grid max-w-7xl px-5 sm:px-8 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="py-14 lg:border-r lg:border-black/20 lg:pr-12 lg:py-20">
              <p className="eyebrow text-grape-400">{t("creatorPage", { handle: profile.handle })}</p>
              <h1 className="display mt-8 max-w-4xl text-[clamp(4.5rem,10vw,8.5rem)] leading-[0.82]">
                {profile.displayName || `@${profile.handle}`}
              </h1>
              {profile.bio && (
                <p className="mt-10 max-w-2xl text-lg leading-relaxed text-mist-500">
                  {profile.bio}
                </p>
              )}
            </div>

            <aside className="flex flex-col justify-between border-t border-black/20 py-8 lg:border-l-0 lg:border-t-0 lg:py-20 lg:pl-10">
              <div>
                <p className="eyebrow text-mist-600">{t("allTimeSupport")}</p>
                <p className="mt-4 font-mono text-5xl font-bold tracking-[-0.08em] text-mint-500">
                  {formatTokenAmount(headline.raised, headline.token.decimals)}
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-mist-500">
                  {t("tokenRaised", { symbol: headline.token.symbol })}
                </p>
                {totals.slice(1).map((entry) => (
                  <p
                    key={entry.token.mint}
                    className="mt-2 font-mono text-sm text-mist-500"
                  >
                    + {formatTokenAmount(entry.raised, entry.token.decimals)}{" "}
                    {entry.token.symbol}
                  </p>
                ))}
              </div>
              <div className="mt-10 border-t border-black/20 pt-4">
                <p className="eyebrow text-mist-600">{t("payoutAddress")}</p>
                <p className="mt-2 font-mono text-xs text-mist-500">
                  {shortAddress(profile.owner, 7)}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mb-8 flex items-end justify-between border-t border-black pt-5">
            <div>
              <p className="eyebrow text-grape-400">{t("activeCount", { count: active.length.toString().padStart(2, "0") })}</p>
              <h2 className="display mt-3 text-5xl">{t("currentGoals")}</h2>
            </div>
          </div>

          {goals.loading ? (
            <div className="grid gap-px bg-black/20 sm:grid-cols-2">
              <div className="h-60 animate-pulse bg-ink-850" />
              <div className="h-60 animate-pulse bg-ink-850" />
            </div>
          ) : active.length === 0 ? (
            <div className="border-y border-black/20 py-12 text-sm text-mist-500">
              {t("noActiveGoals")}
            </div>
          ) : (
            <div className="grid gap-px bg-black/20 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((goal) => (
                <GoalCard key={goal.address} goal={goal.data} handle={handle} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <section className="mt-16">
              <div className="mb-6 border-t border-black/40 pt-4">
                <p className="eyebrow text-mist-500">{t("archiveCount", { count: past.length.toString().padStart(2, "0") })}</p>
              </div>
              <div className="grid gap-px bg-black/20 opacity-65 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((goal) => (
                  <GoalCard key={goal.address} goal={goal.data} handle={handle} />
                ))}
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  );
}

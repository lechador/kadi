"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { unwrapOption } from "@solana/kit";

import { ChainError } from "@/components/ChainError";
import { DonatePanel } from "@/components/DonatePanel";
import { Nav } from "@/components/Nav";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/GoalCard";
import { SupporterList } from "@/components/SupporterList";
import { GoalStatus } from "@/generated";
import { explorerTx } from "@/lib/config";
import {
  formatDeadline,
  formatTokenAmount,
  percent,
  shortAddress,
  timeAgo,
} from "@/lib/format";
import { tokenFor } from "@/lib/tokens";
import { useAsync, useKadiClient } from "@/lib/hooks";
import {
  fetchConfig,
  fetchCreatorByHandle,
  fetchGoalAt,
  fetchGoalSupporters,
  fetchRecentDonations,
  type KadiRpc,
} from "@/lib/queries";

export default function GoalPage() {
  const params = useParams<{ handle: string; index: string }>();
  const handle = params.handle;
  const index = BigInt(params.index ?? "0");
  const client = useKadiClient();
  const rpc = client.rpc as unknown as KadiRpc;

  const creator = useAsync(
    () => fetchCreatorByHandle(client.rpc, handle),
    [client, handle]
  );
  const config = useAsync(() => fetchConfig(client.rpc), [client]);
  const goal = useAsync(async () => {
    if (!creator.data) return null;
    return fetchGoalAt(client.rpc, creator.data.address, index);
  }, [client, creator.data, index]);
  const supporters = useAsync(async () => {
    if (!goal.data) return [];
    return fetchGoalSupporters(rpc, goal.data.address);
  }, [client, goal.data]);
  const donations = useAsync(async () => {
    if (!goal.data) return [];
    return fetchRecentDonations(rpc, goal.data.address);
  }, [client, goal.data]);

  function refresh() {
    goal.reload();
    supporters.reload();
    donations.reload();
  }

  if (goal.loading || creator.loading) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="h-80 animate-pulse border-y border-black/20 bg-ink-850" />
        </main>
      </>
    );
  }

  const chainError = creator.error ?? goal.error;
  if (chainError) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <ChainError
            error={chainError}
            onRetry={() => {
              creator.reload();
              goal.reload();
            }}
          />
        </main>
      </>
    );
  }

  if (!creator.data || !goal.data) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-grape-400">404 / goal</p>
          <h1 className="display mt-5 text-6xl">This goal is not here.</h1>
          <Link href="/" className="mt-7 inline-block text-xs font-bold uppercase tracking-[0.08em] text-grape-400 hover:underline">
            ← Back to all goals
          </Link>
        </main>
      </>
    );
  }

  const data = goal.data.data;
  const deadline = formatDeadline(unwrapOption(data.deadline));
  const reached = data.raised >= data.target;
  const token = tokenFor(data.mint);

  return (
    <>
      <Nav />

      <main>
        <section className="border-b border-black/20 bg-ink-850">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <Link
              href={`/c/${handle}`}
              className="eyebrow text-mist-500 transition-colors hover:text-grape-400"
            >
              ← {creator.data.data.displayName || `@${handle}`}
            </Link>
          </div>

          <div className="mx-auto grid max-w-7xl px-5 sm:px-8 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="pb-12 lg:border-r lg:border-black/20 lg:pr-12 lg:pb-16">
              <div className="flex items-center gap-3">
                <StatusPill status={data.status} />
                {deadline && <span className="eyebrow text-mist-600">{deadline}</span>}
              </div>
              <h1 className="display mt-8 max-w-5xl text-[clamp(4rem,8vw,7.5rem)] leading-[0.86]">
                {data.title}
              </h1>
              {data.description && (
                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mist-500">
                  {data.description}
                </p>
              )}
            </div>

            <aside className="border-t border-black/20 py-8 lg:border-t-0 lg:pl-10">
              <p className="eyebrow text-mist-600">Progress</p>
              <p className="mt-5 font-mono text-[clamp(3rem,5vw,5rem)] font-bold leading-none tracking-[-0.08em]">
                {Math.round(percent(data.raised, data.target))}%
              </p>
              <div className="mt-7">
                <ProgressBar raised={data.raised} target={data.target} />
                <div className="mt-3 flex items-baseline justify-between font-mono text-sm">
                  <span className={reached ? "font-bold text-mint-500" : "font-bold"}>
                    {formatTokenAmount(data.raised, token.decimals)}{" "}
                    {token.symbol}
                  </span>
                  <span className="text-mist-500">
                    of {formatTokenAmount(data.target, token.decimals)}
                  </span>
                </div>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-px bg-black/20 border border-black/20">
                {[
                  [data.donationCount.toString(), "Donations"],
                  [data.supporterCount.toString(), "Supporters"],
                  [timeAgo(data.createdAt), "Started"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-ink-850 p-3">
                    <p className="font-mono text-xs font-bold">{value}</p>
                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-mist-600">{label}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="border-t border-black pt-5">
              <p className="eyebrow text-grape-400">Donation ledger</p>
              <h2 className="display mt-3 text-4xl">Recent support</h2>
              <p className="mt-2 text-xs text-mist-600">
                Every message below is read from the public transaction log.
              </p>
            </div>

            <div className="mt-6">
              {donations.loading ? (
                <div className="h-28 animate-pulse bg-black/5" />
              ) : (donations.data ?? []).length === 0 ? (
                <p className="border-y border-black/20 py-8 text-sm text-mist-600">No donations yet.</p>
              ) : (
                <ol className="border-t border-black/20">
                  {(donations.data ?? []).map((donation, row) => (
                    <li key={donation.signature} className="grid gap-3 border-b border-black/15 py-5 sm:grid-cols-[3rem_1fr_auto]">
                      <span className="font-mono text-[10px] text-mist-600">{String(row + 1).padStart(2, "0")}</span>
                      <div>
                        <p className="font-mono text-xs text-mist-500">
                          {shortAddress(donation.donor, 5)}
                          {donation.isFirstTime && (
                            <span className="ml-2 border border-mint-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-mint-500">
                              first time
                            </span>
                          )}
                        </p>
                        {donation.message && (
                          <p className="display mt-2 text-xl leading-snug">“{donation.message}”</p>
                        )}
                        <a
                          href={explorerTx(donation.signature)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.08em] text-mist-600 hover:text-grape-400"
                        >
                          {timeAgo(donation.timestamp)} · view receipt
                        </a>
                      </div>
                      <span className="font-mono text-sm font-bold text-mint-500">
                        +{formatTokenAmount(donation.amount, token.decimals)}{" "}
                        {token.symbol}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <aside className="space-y-8">
            {config.data && (
              <DonatePanel
                goalAddress={goal.data.address}
                mint={data.mint}
                treasury={config.data.treasury}
                feeBps={config.data.feeBps}
                handle={handle}
                index={index}
                disabled={data.status !== GoalStatus.Active}
                onDonated={refresh}
              />
            )}

            <section className="border-t border-black pt-5">
              <p className="eyebrow text-grape-400">Leaderboard</p>
              <h2 className="display mt-2 text-3xl">Top supporters</h2>
              <SupporterList
                supporters={supporters.data ?? []}
                decimals={token.decimals}
                symbol={token.symbol}
              />
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}

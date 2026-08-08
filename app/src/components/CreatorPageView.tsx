"use client";

import Link from "next/link";

import { GoalCard } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { CreatorSocials } from "@/components/CreatorSocials";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { SOL_TOKEN, tokenFor } from "@/lib/tokens";
import type { CreatorView, GoalView } from "@/lib/views";

export function CreatorPageView({
  creator,
  goals,
}: {
  creator: CreatorView;
  goals: GoalView[];
}) {
  const { t } = useLanguage();

  const active = goals.filter((goal) => goal.status === 0);
  const past = goals.filter((goal) => goal.status !== 0);

  // Totals are kept per denomination — adding lamports to USDC base units
  // would produce a number that means nothing.
  const totals = (() => {
    const byMint = new Map<string, bigint>();
    for (const goal of goals) {
      byMint.set(goal.mint, (byMint.get(goal.mint) ?? 0n) + BigInt(goal.raised));
    }
    return [...byMint.entries()]
      .map(([mint, raised]) => ({ token: tokenFor(mint), raised }))
      .filter((entry) => entry.raised > 0n)
      .sort((a, b) =>
        a.token.symbol === "SOL" ? -1 : b.token.symbol === "SOL" ? 1 : 0
      );
  })();

  const headline = totals[0] ?? { token: SOL_TOKEN, raised: 0n };
  const profile = creator.profile;
  const avatar = profile?.avatarUrl ?? creator.avatarUri ?? null;

  return (
    <>
      <Nav />

      <main>
        {profile?.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.bannerUrl}
            alt=""
            className="h-40 w-full border-b border-black/20 object-cover sm:h-56"
          />
        )}

        <section className="border-b border-black/20 bg-ink-850">
          <div className="mx-auto grid max-w-7xl px-5 sm:px-8 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="py-14 lg:border-r lg:border-black/20 lg:pr-12 lg:py-20">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow text-grape-400">
                  {t("creatorPage", { handle: creator.handle })}
                </p>
                {profile?.category && (
                  <span className="border border-black/20 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-mist-500">
                    {t(`category_${profile.category}`)}
                  </span>
                )}
                {profile?.location && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
                    {profile.location}
                  </span>
                )}
              </div>

              <div className="mt-8 flex items-start gap-5">
                {avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    className="h-20 w-20 shrink-0 border border-black/20 object-cover sm:h-28 sm:w-28"
                  />
                )}
                <h1 className="display max-w-4xl text-[clamp(3rem,8vw,7rem)] leading-[0.85]">
                  {creator.displayName || `@${creator.handle}`}
                </h1>
              </div>

              {creator.bio && (
                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mist-500">
                  {creator.bio}
                </p>
              )}

              {profile?.about && (
                <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-mist-500">
                  {profile.about}
                </p>
              )}

              <div className="mt-8">
                <CreatorSocials profile={profile} />
              </div>
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
                  {shortAddress(creator.owner, 7)}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mb-8 flex items-end justify-between border-t border-black pt-5">
            <div>
              <p className="eyebrow text-grape-400">
                {t("activeCount", {
                  count: String(active.length).padStart(2, "0"),
                })}
              </p>
              <h2 className="display mt-3 text-5xl">{t("currentGoals")}</h2>
            </div>
          </div>

          {active.length === 0 ? (
            <div className="border-y border-black/20 py-12 text-sm text-mist-500">
              {t("noActiveGoals")}
            </div>
          ) : (
            <div className="grid gap-px bg-black/20 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((goal) => (
                <GoalCard key={goal.address} goal={goal} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <section className="mt-16">
              <div className="mb-6 border-t border-black/40 pt-4">
                <p className="eyebrow text-mist-500">
                  {t("archiveCount", {
                    count: String(past.length).padStart(2, "0"),
                  })}
                </p>
              </div>
              <div className="grid gap-px bg-black/20 opacity-65 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((goal) => (
                  <GoalCard key={goal.address} goal={goal} />
                ))}
              </div>
            </section>
          )}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

export function CreatorMissing({ handle }: { handle: string }) {
  const { t } = useLanguage();
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

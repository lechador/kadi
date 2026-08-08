"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { GoalCard } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { useLanguage } from "@/lib/i18n";
import {
  CATEGORIES,
  SORT_OPTIONS,
  type CreatorView,
  type GoalView,
} from "@/lib/views";

/// Discovery.
///
/// Every filter lives in the URL rather than component state, so a search is
/// a link: shareable, bookmarkable, and rendered on the server for whoever
/// opens it. The inputs only ever rewrite that URL.

const DENOMINATIONS = ["all", "sol", "token"] as const;
const STATUSES = ["active", "completed", "all"] as const;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
        active
          ? "border-grape-400 bg-grape-600 text-white"
          : "border-rule text-mist-500 hover:border-rule-solid hover:text-mist-100"
      }`}
    >
      {children}
    </button>
  );
}

export function ExploreView({
  goals,
  creators,
  total,
  page,
  pageSize,
  source,
}: {
  goals: GoalView[];
  creators: CreatorView[];
  total: number;
  page: number;
  pageSize: number;
  source: "db" | "chain";
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const current = {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    denomination: params.get("denomination") ?? "all",
    status: params.get("status") ?? "active",
    sort: params.get("sort") ?? "trending",
  };

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value || value === "all" || (key === "status" && value === "active")) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    // Any change to the filters invalidates the page number — staying on page
    // 3 of a result set that now has one page shows nothing at all.
    if (!("page" in changes)) next.delete("page");

    startTransition(() => {
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    });
  }

  // Debounced so typing does not fire a query per keystroke, while still
  // keeping the URL as the single source of truth.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (search !== current.q) apply({ q: search });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="border-t border-rule-solid pt-5">
          <p className="eyebrow text-grape-400">{t("discover")}</p>
          <h1 className="display mt-3 text-5xl leading-none sm:text-6xl">
            {t("exploreTitle")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist-500">
            {t("exploreBody")}
          </p>
        </div>

        <div className="mt-8 space-y-4 border-y border-rule py-5">
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="field w-full px-3 py-2.5 text-sm"
              aria-label={t("searchPlaceholder")}
            />
            {pending && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
                {t("searching")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
              {t("denomination")}
            </span>
            {DENOMINATIONS.map((option) => (
              <Chip
                key={option}
                active={current.denomination === option}
                onClick={() => apply({ denomination: option })}
              >
                {option === "all"
                  ? t("filterAll")
                  : option === "sol"
                    ? "SOL"
                    : t("filterToken")}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
              {t("status")}
            </span>
            {STATUSES.map((option) => (
              <Chip
                key={option}
                active={current.status === option}
                onClick={() => apply({ status: option })}
              >
                {t(
                  option === "active"
                    ? "active"
                    : option === "completed"
                      ? "completed"
                      : "filterAll"
                )}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
              {t("sortBy")}
            </span>
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option}
                active={current.sort === option}
                onClick={() => apply({ sort: option })}
              >
                {t(`sort_${option}`)}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
              {t("category")}
            </span>
            <Chip
              active={current.category === ""}
              onClick={() => apply({ category: "" })}
            >
              {t("filterAll")}
            </Chip>
            {CATEGORIES.map((option) => (
              <Chip
                key={option}
                active={current.category === option}
                onClick={() => apply({ category: option })}
              >
                {t(`category_${option}`)}
              </Chip>
            ))}
          </div>
        </div>

        {creators.length > 0 && (
          <div className="mt-6 border-b border-rule-faint pb-5">
            <p className="eyebrow mb-3 text-mist-600">{t("creators")}</p>
            <div className="flex flex-wrap gap-2">
              {creators.map((creator) => (
                <Link
                  key={creator.address}
                  href={`/c/${creator.handle}`}
                  className="flex items-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-rule-solid"
                >
                  <span className="text-sm text-mist-100">
                    {creator.displayName || `@${creator.handle}`}
                  </span>
                  <span className="font-mono text-[10px] text-mist-600">
                    @{creator.handle}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
          {t("resultCount", { count: total })}
          {source === "chain" && ` · ${t("readFromChain")}`}
        </p>

        {goals.length === 0 ? (
          <div className="border-y border-rule py-16 text-center">
            <p className="display text-3xl">{t("noResults")}</p>
            <p className="mt-3 text-sm text-mist-500">{t("noResultsBody")}</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard key={goal.address} goal={goal} showCreator />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-between border-t border-rule pt-5">
            <PageLink
              disabled={page <= 1}
              label={`← ${t("previous")}`}
              onClick={() => apply({ page: String(page - 1) })}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
              {t("pageOf", { page, pages })}
            </span>
            <PageLink
              disabled={page >= pages}
              label={`${t("next")} →`}
              onClick={() => apply({ page: String(page + 1) })}
            />
          </nav>
        )}

        <div className="mt-14 border-t border-rule pt-6">
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-[0.08em] text-grape-400 hover:underline"
          >
            {t("claimHandleArrow")}
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function PageLink({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border border-rule px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-mist-400 hover:border-rule-solid disabled:opacity-35"
    >
      {label}
    </button>
  );
}

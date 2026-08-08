import type { Metadata } from "next";

import { ExploreView } from "@/components/ExploreView";
import { loadCreators, loadGoalCount, loadGoals } from "@/lib/server/data";
import { isCategory, isSortOption } from "@/lib/views";

/// Search and filtering, server-side.
///
/// This page could not exist before the cache: matching a query against every
/// goal's title meant pulling every goal account over RPC first. With the
/// index it is one query with a trigram index behind it, and the result is a
/// URL a creator can share.

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "მიზნების ძებნა — Kadi",
  description:
    "მოძებნე კრეატორები და მიმდინარე მიზნები Kadi-ზე. გაფილტრე კატეგორიით, ვალუტით და სტატუსით.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const search = single(params.q).slice(0, 100);
  const category = isCategory(single(params.category)) ? single(params.category) : null;
  const sortParam = single(params.sort);
  const sort = isSortOption(sortParam) ? sortParam : "trending";

  const statusParam = single(params.status);
  const status =
    statusParam === "completed" || statusParam === "archived" || statusParam === "all"
      ? statusParam
      : "active";

  const denominationParam = single(params.denomination);
  const denomination =
    denominationParam === "sol" || denominationParam === "token"
      ? denominationParam
      : "all";

  const page = Math.max(1, Number(single(params.page)) || 1);

  const filter = { search, category, status, denomination, sort } as const;

  const [goals, total, creators] = await Promise.all([
    loadGoals({ ...filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    loadGoalCount(filter),
    // Matching creators are listed alongside the goals, because a creator
    // between campaigns has no active goal to be found through — searching
    // their name and being told "nothing matched" would be wrong.
    search ? loadCreators({ search, category, limit: 8 }) : null,
  ]);

  return (
    <ExploreView
      goals={goals.data}
      creators={creators?.data ?? []}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      source={goals.source}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ProgressBar } from "@/components/ProgressBar";
import { KADI_PROGRAM_ADDRESS, type Goal } from "@/generated";
import { parseDonationEvents, type DonationEvent } from "@/lib/events";
import { formatSol, shortAddress } from "@/lib/format";
import { useAsync, useKadiClient } from "@/lib/hooks";
import { fetchCreatorByHandle, fetchCreatorGoals } from "@/lib/queries";
import { useLanguage } from "@/lib/i18n";

const HOLD_MS = 5_200;
const EXIT_MS = 380;

/// Transparent OBS browser source. It subscribes directly to the program's
/// logs, so an alert fires the moment a donation is confirmed — there is no
/// webhook, backend or polling loop between the chain and the stream.
export default function OverlayPage() {
  const { t } = useLanguage();
  const params = useParams<{ handle: string }>();
  const search = useSearchParams();
  const handle = params.handle;
  const client = useKadiClient();

  const showBar = search.get("bar") !== "0";
  const goalIndex = search.get("goal");
  /// `?test=1` adds a trigger so a creator can confirm their OBS browser
  /// source is wired up without waiting for a real donation. It is opt-in so
  /// the button can never appear on a live stream.
  const testMode = search.get("test") === "1";

  const [queue, setQueue] = useState<DonationEvent[]>([]);
  const [current, setCurrent] = useState<DonationEvent | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [connected, setConnected] = useState(false);

  // OBS composites the page over the scene, so the document itself must not
  // paint a background.
  useEffect(() => {
    const html = document.documentElement;
    const previous = [html.style.background, document.body.style.background];
    html.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => {
      html.style.background = previous[0];
      document.body.style.background = previous[1];
    };
  }, []);

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

  const creatorAddress = creator.data?.address;

  // --- live subscription ---------------------------------------------------
  useEffect(() => {
    if (!creatorAddress) return;
    const controller = new AbortController();

    (async () => {
      try {
        const notifications = await client.rpcSubscriptions
          .logsNotifications(
            { mentions: [KADI_PROGRAM_ADDRESS] },
            { commitment: "confirmed" }
          )
          .subscribe({ abortSignal: controller.signal });

        setConnected(true);

        for await (const notification of notifications) {
          const donations = parseDonationEvents(
            notification.value.logs
          ).filter((event) => event.creator === creatorAddress);

          if (donations.length > 0) {
            setQueue((pending) => [...pending, ...donations]);
            goals.reload();
          }
        }
      } catch {
        if (!controller.signal.aborted) setConnected(false);
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, creatorAddress]);

  // --- one alert at a time -------------------------------------------------
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((pending) => pending.slice(1));
  }, [current, queue]);

  useEffect(() => {
    if (!current) return;
    const startExit = setTimeout(() => setLeaving(true), HOLD_MS);
    const finish = setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, HOLD_MS + EXIT_MS);
    return () => {
      clearTimeout(startExit);
      clearTimeout(finish);
    };
  }, [current]);

  const trackedGoal: Goal | undefined = (() => {
    const list = goals.data ?? [];
    if (goalIndex !== null) {
      return list.find((goal) => goal.data.index === BigInt(goalIndex))?.data;
    }
    return list.find((goal) => goal.data.status === 0)?.data;
  })();

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      {/* Alert */}
      <div className="absolute left-1/2 top-16 w-[min(34rem,90vw)] -translate-x-1/2">
        {current && (
          <div
            className={leaving ? "alert-exit" : "alert-enter"}
            key={`${current.donor}-${current.timestamp}`}
          >
            <div className="border border-black/40 bg-ink-850/95 p-6 shadow-[8px_8px_0_#c63d2f] backdrop-blur-sm">
              <p className="eyebrow mb-4 border-b border-black/20 pb-3 text-grape-400">
                {t("newDonation")}
              </p>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-lg text-mist-100">
                  {shortAddress(current.donor, 4)}
                </span>
                <span className="font-mono text-3xl font-bold tracking-[-0.06em] text-grape-400">
                  {formatSol(current.amount)} SOL
                </span>
              </div>

              {current.isFirstTime && (
                <span className="mt-3 inline-block border border-mint-400 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-mint-500">
                  {t("firstTimeSupporter")}
                </span>
              )}

              {current.message && (
                <p className="display mt-4 text-pretty text-2xl leading-snug text-mist-100">
                  “{current.message}”
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Goal bar */}
      {showBar && trackedGoal && (
        <div className="absolute bottom-10 left-1/2 w-[min(30rem,88vw)] -translate-x-1/2">
          <div className="border border-black/40 bg-ink-850/95 px-5 py-4 shadow-[5px_5px_0_#171714] backdrop-blur-sm">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-mist-100">
                {trackedGoal.title}
              </span>
              <span className="shrink-0 text-sm text-mist-300">
                <span className="font-semibold text-mint-300">
                  {formatSol(trackedGoal.raised)}
                </span>
                {" / "}
                {formatSol(trackedGoal.target)}
              </span>
            </div>
            <ProgressBar
              raised={trackedGoal.raised}
              target={trackedGoal.target}
            />
          </div>
        </div>
      )}

      {/* Setup aid — only visible before the socket is live, never during a stream. */}
      {testMode && (
        <button
          type="button"
          onClick={() =>
            setQueue((pending) => [
              ...pending,
              {
                goal: (trackedGoal?.creator ?? "") as DonationEvent["goal"],
                creator: (creatorAddress ?? "") as DonationEvent["creator"],
                donor:
                  "7v54NWdBtkjuAFJrLGsS2SXnuk8nKam81mZJeeYxVFi9" as DonationEvent["donor"],
                mint: "11111111111111111111111111111111" as DonationEvent["mint"],
                amount: 1_500_000_000n,
                net: 1_462_500_000n,
                fee: 37_500_000n,
                message: "Test alert — თუ ამას ხედავ, ყველაფერი მუშაობს!",
                raised: trackedGoal?.raised ?? 0n,
                target: trackedGoal?.target ?? 1n,
                isFirstTime: true,
                timestamp: BigInt(Math.floor(Date.now() / 1000)),
              },
            ])
          }
          className="absolute bottom-3 right-3 border border-black/30 bg-ink-850 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-mist-300 hover:border-black"
        >
          {t("fireTest")}
        </button>
      )}

      {!connected && (
        <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1.5 font-mono text-[11px] text-white/70">
          {creator.loading
            ? t("connecting")
            : !creator.data
              ? t("noCreatorShort", { handle })
              : t("waitingRpc")}
        </div>
      )}
    </div>
  );
}

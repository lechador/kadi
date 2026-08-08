"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { ProgressBar } from "@/components/ProgressBar";
import type { Goal } from "@/generated";
import { formatTokenAmount, shortAddress } from "@/lib/format";
import { useAsync, useKadiClient } from "@/lib/hooks";
import { useLiveDonations, type LiveDonation } from "@/lib/live";
import { fetchCreatorByHandle, fetchCreatorGoals } from "@/lib/queries";
import { tokenFor } from "@/lib/tokens";
import { useLanguage } from "@/lib/i18n";
import { DEFAULT_OVERLAY_SETTINGS, type OverlaySettingsView } from "@/lib/views";

const EXIT_MS = 380;

/// Transparent OBS browser source.
///
/// The alert path is unchanged and deliberately so: it subscribes straight to
/// the program's logs, so a donation appears on stream the moment it confirms —
/// no webhook, no poll, nothing between the chain and the scene. What the
/// database added is only how the source *looks*: colour, duration, sound, the
/// minimum that earns an interruption. A creator changes those in the dashboard
/// instead of editing the URL in OBS mid-stream.
///
/// The page is also the protocol's most reliable indexer client. It runs for
/// the length of a broadcast, so it is the thing most likely to be watching
/// when a Solana Pay QR donation lands with no browser of its own to report it.
export default function OverlayPage() {
  const { t } = useLanguage();
  const params = useParams<{ handle: string }>();
  const search = useSearchParams();
  const handle = params.handle;
  const client = useKadiClient();

  const [settings, setSettings] = useState<OverlaySettingsView>(
    DEFAULT_OVERLAY_SETTINGS
  );
  const [queue, setQueue] = useState<LiveDonation[]>([]);
  const [current, setCurrent] = useState<LiveDonation | null>(null);
  const [leaving, setLeaving] = useState(false);

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

  const creatorAddress = creator.data?.address ?? null;

  useEffect(() => {
    let live = true;
    fetch(`/api/creators/${encodeURIComponent(handle)}/overlay`)
      .then((response) => response.json())
      .then((body: { settings: OverlaySettingsView }) => {
        if (live && body.settings) setSettings(body.settings);
      })
      .catch(() => {
        // Defaults are already on screen; a source that keeps working with the
        // stock look beats one that goes blank because a fetch failed.
      });
    return () => {
      live = false;
    };
  }, [handle]);

  // The URL still wins. A creator troubleshooting mid-stream should be able to
  // override a stored setting without going back to the dashboard, and the
  // documented `?goal=` / `?bar=0` links stay valid.
  const showBar = search.get("bar") !== "0" && settings.showBar;
  const pinnedGoal = search.get("goal") ?? settings.pinnedGoalIndex;
  const testMode = search.get("test") === "1";

  const trackedGoal: Goal | undefined = useMemo(() => {
    const list = goals.data ?? [];
    if (pinnedGoal !== null && pinnedGoal !== undefined) {
      const found = list.find(
        (goal) => goal.data.index === BigInt(pinnedGoal)
      )?.data;
      if (found) return found;
    }
    return list.find((goal) => goal.data.status === 0)?.data;
  }, [goals.data, pinnedGoal]);

  const accept = useCallback(
    (donation: LiveDonation) => {
      const minimum = BigInt(settings.minAmount);
      if (minimum > 0n && BigInt(donation.amount) < minimum) return;
      setQueue((pending) => [...pending, donation]);
      goals.reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.minAmount]
  );

  const { connected } = useLiveDonations({
    creatorAddress,
    report: true,
    onDonation: accept,
  });

  // --- one alert at a time -------------------------------------------------
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((pending) => pending.slice(1));
  }, [current, queue]);

  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!current) return;

    if (settings.soundEnabled && settings.soundUrl) {
      audio.current = new Audio(settings.soundUrl);
      // Autoplay is blocked in a normal tab and allowed in OBS's browser
      // source. A rejected promise here is the former, and it is not an error
      // worth surfacing on someone's stream.
      void audio.current.play().catch(() => {});
    }

    if (settings.ttsEnabled && current.message && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(current.message);
      utterance.rate = settings.ttsRate;
      if (settings.ttsVoice) {
        const voice = window.speechSynthesis
          .getVoices()
          .find((candidate) => candidate.name === settings.ttsVoice);
        if (voice) utterance.voice = voice;
      }
      window.speechSynthesis.speak(utterance);
    }

    const startExit = setTimeout(() => setLeaving(true), settings.alertDurationMs);
    const finish = setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, settings.alertDurationMs + EXIT_MS);

    return () => {
      clearTimeout(startExit);
      clearTimeout(finish);
    };
  }, [current, settings]);

  const token = tokenFor(current?.mint ?? trackedGoal?.mint ?? "");
  const barToken = tokenFor(trackedGoal?.mint ?? "");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      {/* Alert */}
      <div className="absolute left-1/2 top-16 w-[min(34rem,90vw)] -translate-x-1/2">
        {current && (
          <div
            className={leaving ? "alert-exit" : "alert-enter"}
            key={`${current.signature}-${current.donor}`}
          >
            <div
              className="border border-rule-strong bg-ink-850/95 p-6 backdrop-blur-sm"
              style={{ boxShadow: `8px 8px 0 ${settings.accent}` }}
            >
              <p
                className="eyebrow mb-4 border-b border-rule pb-3"
                style={{ color: settings.accent }}
              >
                {settings.alertHeading || t("newDonation")}
              </p>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-lg text-mist-100">
                  {shortAddress(current.donor, 4)}
                </span>
                <span
                  className="font-mono text-3xl font-bold tracking-[-0.06em]"
                  style={{ color: settings.accent }}
                >
                  {formatTokenAmount(BigInt(current.amount), token.decimals)}{" "}
                  {token.symbol}
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
          <div className="border border-rule-strong bg-ink-850/95 px-5 py-4 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.85)] backdrop-blur-sm">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-mist-100">
                {trackedGoal.title}
              </span>
              <span className="shrink-0 text-sm text-mist-300">
                <span className="font-semibold text-mint-300">
                  {formatTokenAmount(trackedGoal.raised, barToken.decimals)}
                </span>
                {" / "}
                {formatTokenAmount(trackedGoal.target, barToken.decimals)}
              </span>
            </div>
            <ProgressBar
              raised={trackedGoal.raised}
              target={trackedGoal.target}
            />
          </div>
        </div>
      )}

      {/* Setup aid — opt-in, so the button can never appear on a live stream. */}
      {testMode && (
        <button
          type="button"
          onClick={() =>
            setQueue((pending) => [
              ...pending,
              {
                signature: `test-${pending.length}`,
                eventIndex: 0,
                goalAddress: trackedGoal ? "" : "",
                creatorAddress: creatorAddress ?? "",
                handle,
                goalTitle: trackedGoal?.title ?? null,
                goalIndex: null,
                donor: "7v54NWdBtkjuAFJrLGsS2SXnuk8nKam81mZJeeYxVFi9",
                mint: trackedGoal?.mint ?? "11111111111111111111111111111111",
                amount: "1500000000",
                net: "1462500000",
                fee: "37500000",
                message: "Test alert — თუ ამას ხედავ, ყველაფერი მუშაობს!",
                isFirstTime: true,
                timestamp: Math.floor(Date.now() / 1000),
                live: true,
              },
            ])
          }
          className="absolute bottom-3 right-3 border border-rule-strong bg-ink-850 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-mist-300 hover:border-rule-solid"
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

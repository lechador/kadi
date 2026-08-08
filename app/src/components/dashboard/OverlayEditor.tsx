"use client";

import { useEffect, useState } from "react";

import { formatSol, solToLamports } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import {
  DEFAULT_OVERLAY_SETTINGS,
  type GoalView,
  type OverlaySettingsView,
} from "@/lib/views";

/// The dashboard half of the OBS overlay.
///
/// Before this, changing anything about an alert meant editing the browser
/// source URL in OBS — during a stream, in a text field, with the scene live.
/// These are the same knobs, stored per creator and picked up by the overlay
/// without touching OBS at all.
export function OverlayEditor({
  handle,
  goals,
  overlayUrl,
}: {
  handle: string;
  goals: GoalView[];
  overlayUrl: string;
}) {
  const { t } = useLanguage();
  const { address, matchesWallet } = useSession();

  const [settings, setSettings] = useState<OverlaySettingsView>(
    DEFAULT_OVERLAY_SETTINGS
  );
  const [minSol, setMinSol] = useState("0");
  const [voices, setVoices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  const editable = Boolean(address && matchesWallet);

  useEffect(() => {
    fetch(`/api/creators/${encodeURIComponent(handle)}/overlay`)
      .then((response) => response.json())
      .then((body: { settings: OverlaySettingsView }) => {
        if (!body.settings) return;
        setSettings(body.settings);
        setMinSol(formatSol(BigInt(body.settings.minAmount), 4));
      })
      .catch(() => {});
  }, [handle]);

  // Voices load asynchronously in every browser, and the first call usually
  // returns an empty list.
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const read = () =>
      setVoices(window.speechSynthesis.getVoices().map((voice) => voice.name));
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  function set<K extends keyof OverlaySettingsView>(
    key: K,
    value: OverlaySettingsView[K]
  ) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const minAmount = solToLamports(minSol || "0");
      const response = await fetch(
        `/api/creators/${encodeURIComponent(handle)}/overlay`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            minAmount: (minAmount ?? 0n).toString(),
          }),
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? t("couldNotSave"));
      }
      const body = (await response.json()) as { settings: OverlaySettingsView };
      setSettings(body.settings);
      setMinSol(formatSol(BigInt(body.settings.minAmount), 4));
      setSaved(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border-black/25 p-6 sm:p-8">
      <p className="eyebrow text-grape-400">{t("obsSource")}</p>
      <h2 className="display mt-2 text-3xl">{t("overlaySettings")}</h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-mist-600">
        {t("overlaySettingsBody")}
      </p>

      <fieldset
        disabled={!editable || busy}
        className="mt-6 grid gap-5 disabled:opacity-55 sm:grid-cols-2"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("alertDuration")} — {(settings.alertDurationMs / 1000).toFixed(1)}
            {t("seconds")}
          </span>
          {/* Bounds match the server's clamp exactly, so the slider can always
              represent what is actually stored. */}
          <input
            type="range"
            min={1000}
            max={30000}
            step={200}
            value={settings.alertDurationMs}
            onChange={(event) =>
              set("alertDurationMs", Number(event.target.value))
            }
            className="w-full accent-grape-400"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("accentColour")}
          </span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.accent}
              onChange={(event) => set("accent", event.target.value)}
              className="h-10 w-16 border border-black/20 bg-transparent"
            />
            <code className="font-mono text-xs text-mist-500">
              {settings.accent}
            </code>
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("minAmount")}
          </span>
          <input
            value={minSol}
            onChange={(event) => {
              setSaved(false);
              setMinSol(event.target.value);
            }}
            inputMode="decimal"
            className="field w-full px-3 py-2.5 text-sm"
          />
          <span className="mt-1 block text-[10px] leading-relaxed text-mist-600">
            {t("minAmountBody")}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("alertHeading")}
          </span>
          <input
            value={settings.alertHeading ?? ""}
            onChange={(event) => set("alertHeading", event.target.value || null)}
            maxLength={60}
            placeholder={t("newDonation")}
            className="field w-full px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("pinnedGoal")}
          </span>
          <select
            value={settings.pinnedGoalIndex ?? ""}
            onChange={(event) =>
              set(
                "pinnedGoalIndex",
                event.target.value === "" ? null : Number(event.target.value)
              )
            }
            className="field w-full px-3 py-2.5 text-sm"
          >
            <option value="">{t("pinnedGoalAuto")}</option>
            {goals.map((goal) => (
              <option key={goal.address} value={goal.index}>
                {goal.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 self-end pb-2.5">
          <input
            type="checkbox"
            checked={settings.showBar}
            onChange={(event) => set("showBar", event.target.checked)}
            className="h-4 w-4 accent-grape-400"
          />
          <span className="text-xs font-medium text-mist-500">
            {t("showGoalBar")}
          </span>
        </label>

        <div className="sm:col-span-2 border-t border-black/15 pt-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => set("soundEnabled", event.target.checked)}
              className="h-4 w-4 accent-grape-400"
            />
            <span className="text-xs font-medium text-mist-500">
              {t("enableSound")}
            </span>
          </label>
          {settings.soundEnabled && (
            <input
              value={settings.soundUrl ?? ""}
              onChange={(event) => set("soundUrl", event.target.value || null)}
              placeholder="https://…/alert.mp3"
              aria-label={t("soundUrl")}
              className="field mt-3 w-full px-3 py-2.5 text-sm"
            />
          )}
        </div>

        <div className="sm:col-span-2 border-t border-black/15 pt-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.ttsEnabled}
              onChange={(event) => set("ttsEnabled", event.target.checked)}
              className="h-4 w-4 accent-grape-400"
            />
            <span className="text-xs font-medium text-mist-500">
              {t("enableTts")}
            </span>
          </label>

          {settings.ttsEnabled && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-500">
                  {t("ttsVoice")}
                </span>
                <select
                  value={settings.ttsVoice ?? ""}
                  onChange={(event) =>
                    set("ttsVoice", event.target.value || null)
                  }
                  className="field w-full px-3 py-2.5 text-sm"
                >
                  <option value="">{t("ttsDefaultVoice")}</option>
                  {voices.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-mist-500">
                  {t("ttsRate")} — {settings.ttsRate.toFixed(1)}×
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={settings.ttsRate}
                  onChange={(event) =>
                    set("ttsRate", Number(event.target.value))
                  }
                  className="w-full accent-grape-400"
                />
              </label>
            </div>
          )}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!editable || busy}
          className="btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {busy ? t("saving") : t("saveOverlay")}
        </button>
        <a
          href={`${overlayUrl}?test=1`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {t("openTestAlert")}
        </a>
        {saved && (
          <span className="text-xs text-mint-300">{t("overlaySaved")}</span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </section>
  );
}

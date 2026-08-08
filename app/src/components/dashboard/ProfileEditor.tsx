"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { CATEGORIES, type ProfileView } from "@/lib/views";

const EMPTY: ProfileView = {
  bannerUrl: null,
  avatarUrl: null,
  about: null,
  category: null,
  location: null,
  website: null,
  twitter: null,
  youtube: null,
  twitch: null,
  instagram: null,
  tiktok: null,
  discord: null,
  accent: null,
};

const SOCIALS: { key: keyof ProfileView; label: string; hint: string }[] = [
  { key: "twitter", label: "X", hint: "nikoloz" },
  { key: "youtube", label: "YouTube", hint: "nikolozlive" },
  { key: "twitch", label: "Twitch", hint: "nikoloz" },
  { key: "instagram", label: "Instagram", hint: "nikoloz" },
  { key: "tiktok", label: "TikTok", hint: "nikoloz" },
  { key: "discord", label: "Discord", hint: "nikoloz#0001" },
];

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-mist-500">
        {label}
        {hint && <span className="ml-2 text-mist-600">{hint}</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field w-full px-3 py-2.5 text-sm"
      />
    </label>
  );
}

/// The presentation layer of a creator page.
///
/// Everything on this form lives in Postgres, not on the chain, and the copy
/// says so — a creator should know which of their settings survives the
/// database being wiped and which does not. The answer: the money, the goals,
/// the handle and the bio all do.
export function ProfileEditor({
  handle,
  initial,
}: {
  handle: string;
  initial: ProfileView | null;
}) {
  const { t } = useLanguage();
  const { address, matchesWallet } = useSession();

  const [profile, setProfile] = useState<ProfileView>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setProfile(initial ?? EMPTY);
  }, [initial]);

  const editable = Boolean(address && matchesWallet);

  function set(key: keyof ProfileView, value: string) {
    setSaved(false);
    setProfile((current) => ({ ...current, [key]: value || null }));
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/creators/${encodeURIComponent(handle)}/profile`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? t("couldNotSave"));
      }
      // The server normalises what it stored — a pasted profile URL comes back
      // as a bare handle — so the form is refilled from the response rather
      // than from what was typed.
      const body = (await response.json()) as { profile: ProfileView };
      setProfile(body.profile);
      setSaved(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border-rule p-6 sm:p-8">
      <p className="eyebrow text-grape-400">{t("pageStyle")}</p>
      <h2 className="display mt-2 text-3xl">{t("profileExtrasTitle")}</h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-mist-600">
        {t("pageStyleBody")}
      </p>

      <fieldset
        disabled={!editable || busy}
        className="mt-6 space-y-4 disabled:opacity-55"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("bannerUrl")}
            value={profile.bannerUrl ?? ""}
            onChange={(value) => set("bannerUrl", value)}
            placeholder="https://…"
          />
          <Field
            label={t("avatarImage")}
            value={profile.avatarUrl ?? ""}
            onChange={(value) => set("avatarUrl", value)}
            placeholder="https://…"
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("about")}
          </span>
          <textarea
            value={profile.about ?? ""}
            onChange={(event) => set("about", event.target.value)}
            rows={4}
            maxLength={2000}
            className="field w-full resize-none px-3 py-2.5 text-sm"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-mist-500">
              {t("category")}
            </span>
            <select
              value={profile.category ?? ""}
              onChange={(event) => set("category", event.target.value)}
              className="field w-full px-3 py-2.5 text-sm"
            >
              <option value="">—</option>
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {t(`category_${option}`)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t("location")}
            value={profile.location ?? ""}
            onChange={(value) => set("location", value)}
            placeholder="თბილისი"
          />
        </div>

        <Field
          label={t("website")}
          value={profile.website ?? ""}
          onChange={(value) => set("website", value)}
          placeholder="https://…"
        />

        <div>
          <p className="mb-2 text-xs font-medium text-mist-500">{t("socials")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIALS.map((social) => (
              <Field
                key={social.key}
                label={social.label}
                value={(profile[social.key] as string | null) ?? ""}
                onChange={(value) => set(social.key, value)}
                placeholder={social.hint}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!editable || busy}
          className="btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {busy ? t("saving") : t("saveProfile")}
        </button>
        {saved && (
          <span className="text-xs text-mint-300">{t("profileSaved")}</span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </section>
  );
}

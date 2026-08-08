"use client";

import Link from "next/link";
import { useState } from "react";
import type { Address } from "@solana/kit";

import { ChainError } from "@/components/ChainError";
import { StatusPill } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { ProgressBar } from "@/components/ProgressBar";
import { WalletButton } from "@/components/WalletButton";
import { Analytics } from "@/components/dashboard/Analytics";
import { OverlayEditor } from "@/components/dashboard/OverlayEditor";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { SignInBar } from "@/components/dashboard/SignInBar";
import { GoalStatus, type Creator, type Goal } from "@/generated";
import {
  claimSol,
  claimToken,
  createGoal,
  createTokenGoal,
  registerCreator,
  setGoalStatus,
  updateCreator,
} from "@/lib/actions";
import { APP_URL, explorerTx } from "@/lib/config";
import {
  formatTokenAmount,
  isValidHandle,
  parseTokenAmount,
} from "@/lib/format";
import { useAsync, useKadiClient, useWallet } from "@/lib/hooks";
import { findGoalPda } from "@/lib/pda";
import {
  fetchClaimable,
  fetchCreatorByOwner,
  fetchCreatorGoals,
  fetchTokenClaimable,
  type KadiRpc,
  type WithAddress,
} from "@/lib/queries";
import { SUPPORTED_TOKENS, isNativeMint, tokenFor } from "@/lib/tokens";
import { useLanguage } from "@/lib/i18n";
import type { GoalView, ProfileView } from "@/lib/views";

export default function DashboardPage() {
  const { t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();
  const rpc = client.rpc as unknown as KadiRpc;

  const creator = useAsync(async () => {
    if (!connected?.account) return null;
    return fetchCreatorByOwner(rpc, connected.account.address as Address);
  }, [client, connected?.account?.address]);

  const goals = useAsync(async () => {
    if (!creator.data) return [];
    return fetchCreatorGoals(
      client.rpc,
      creator.data.address,
      creator.data.data.goalCount
    );
  }, [client, creator.data]);

  if (!connected?.signer) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-xl px-5 py-28 text-center">
          <p className="eyebrow text-grape-400">{t("creatorStudio")}</p>
          <h1 className="display mt-5 text-6xl leading-none">
            {t("connectWallet")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-mist-500">
            {t("walletIsAccount")}
          </p>
          <div className="mt-6 flex justify-center">
            <WalletButton />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        {creator.error ? (
          <ChainError error={creator.error} onRetry={creator.reload} />
        ) : creator.loading ? (
          <div className="card h-40 animate-pulse opacity-50" />
        ) : creator.data ? (
          <CreatorDashboard
            creator={creator.data}
            goals={goals.data ?? []}
            goalsLoading={goals.loading}
            onChanged={() => {
              creator.reload();
              goals.reload();
            }}
          />
        ) : (
          <RegisterForm onRegistered={creator.reload} />
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------

function RegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const { t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const handleValid = isValidHandle(handle);

  async function submit() {
    if (!connected?.signer) return;
    setBusy(true);
    setError(undefined);
    try {
      const instruction = await registerCreator({
        owner: connected.signer,
        handle,
        displayName: displayName || handle,
        bio,
        avatarUri: "",
      });
      await client.sendTransaction([instruction]);
      onRegistered();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("registrationFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl border-t border-black pt-6">
      <p className="eyebrow text-grape-400">{t("creatorRegistration")}</p>
      <h1 className="display mt-5 text-6xl leading-none">
        {t("claimYourHandle")}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-mist-500">
        {t("handleBody")}
      </p>

      <label className="mb-1.5 mt-6 block text-xs font-medium text-mist-500">
        {t("handle")}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-mist-600">kadi.fund/c/</span>
        <input
          value={handle}
          onChange={(event) => setHandle(event.target.value.toLowerCase())}
          className="field flex-1 px-3 py-2.5 text-sm"
          placeholder="nikoloz_live"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      {handle && !handleValid && (
        <p className="mt-1.5 text-xs text-ember-400">
          {t("handleRules")}
        </p>
      )}

      <label className="mb-1.5 mt-4 block text-xs font-medium text-mist-500">
        {t("displayName")}
      </label>
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        className="field w-full px-3 py-2.5 text-sm"
        placeholder="Nikoloz"
      />

      <label className="mb-1.5 mt-4 block text-xs font-medium text-mist-500">
        {t("bio")}
      </label>
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        rows={3}
        className="field w-full resize-none px-3 py-2.5 text-sm"
        placeholder={t("goalDescriptionPlaceholder")}
      />

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!handleValid || busy}
        className="btn-primary mt-6 w-full px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]"
      >
        {busy ? t("registering") : t("claimHandle")}
      </button>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreatorDashboard({
  creator,
  goals,
  goalsLoading,
  onChanged,
}: {
  creator: WithAddress<Creator>;
  goals: WithAddress<Goal>[];
  goalsLoading: boolean;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const handle = creator.data.handle;
  const overlayUrl = `${APP_URL}/overlay/${handle}`;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const profile = useAsync(async () => {
    const response = await fetch(
      `/api/creators/${encodeURIComponent(handle)}/profile`
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { profile: ProfileView | null };
    return body.profile;
  }, [handle]);

  // The overlay's goal picker only needs titles and indexes, so the decoded
  // accounts are narrowed to the view shape rather than threaded through.
  const goalOptions: GoalView[] = goals.map((goal) => ({
    address: goal.address,
    creatorAddress: goal.data.creator,
    handle,
    creatorName: creator.data.displayName,
    creatorAvatar: null,
    index: Number(goal.data.index),
    title: goal.data.title,
    description: goal.data.description,
    mint: goal.data.mint,
    target: goal.data.target.toString(),
    raised: goal.data.raised.toString(),
    claimed: goal.data.claimed.toString(),
    donationCount: Number(goal.data.donationCount),
    supporterCount: Number(goal.data.supporterCount),
    status: Number(goal.data.status),
    deadline: null,
    createdAt: Number(goal.data.createdAt),
  }));

  return (
    <>
      <section className="mb-8 border-y border-black/20 bg-ink-850 p-7 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-4 text-grape-400">{t("creatorStudio")}</p>
            <h1 className="display text-5xl leading-none">
              {creator.data.displayName}
            </h1>
            <Link
              href={`/c/${handle}`}
              className="font-mono text-sm text-grape-400 hover:underline"
            >
              @{handle}
            </Link>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-[0.06em]"
            >
              {editing ? t("close") : t("editProfile")}
            </button>
            <Link
              href={`/c/${handle}`}
              className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-[0.06em]"
            >
              {t("viewPublicPage")}
            </Link>
          </div>
        </div>

        {editing && (
          <EditProfileForm
            creator={creator}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
          />
        )}

        <div className="mt-8 border-t border-black/20 bg-ink-900 p-4">
          <p className="text-xs font-medium text-mist-500">
            {t("obsSource")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-mist-600">
            {t("obsBody")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate border border-black/10 bg-ink-950 px-3 py-2 font-mono text-xs text-mist-300">
              {overlayUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(overlayUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="shrink-0 border border-black/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.05em] text-mist-300 hover:border-black"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <SignInBar />
        </div>
      </section>

      <div className="mb-8 space-y-8">
        <Analytics handle={handle} />
        <ProfileEditor handle={handle} initial={profile.data ?? null} />
        <OverlayEditor
          handle={handle}
          goals={goalOptions}
          overlayUrl={overlayUrl}
        />
      </div>

      <CreateGoalForm
        creator={creator.address}
        nextIndex={creator.data.goalCount}
        onCreated={onChanged}
      />

      <div className="mb-4 mt-12 border-t border-black pt-5">
        <p className="eyebrow text-grape-400">{t("portfolio")}</p>
        <h2 className="display mt-2 text-4xl">{t("yourGoals")}</h2>
      </div>

      {goalsLoading ? (
        <div className="card h-32 animate-pulse opacity-50" />
      ) : goals.length === 0 ? (
        <div className="card p-8 text-center text-sm text-mist-500">
          {t("noGoals")}
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalRow
              key={goal.address}
              goal={goal}
              handle={handle}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function EditProfileForm({
  creator,
  onSaved,
}: {
  creator: WithAddress<Creator>;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();

  const [displayName, setDisplayName] = useState(creator.data.displayName);
  const [bio, setBio] = useState(creator.data.bio);
  const [avatarUri, setAvatarUri] = useState(creator.data.avatarUri);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const dirty =
    displayName !== creator.data.displayName ||
    bio !== creator.data.bio ||
    avatarUri !== creator.data.avatarUri;

  async function save() {
    if (!connected?.signer) return;
    setBusy(true);
    setError(undefined);
    try {
      // Each field is Option<String> on-chain: only changed fields are sent, so
      // an untouched field is left exactly as it was.
      const instruction = updateCreator({
        creator: creator.address,
        owner: connected.signer,
        displayName:
          displayName === creator.data.displayName ? null : displayName,
        bio: bio === creator.data.bio ? null : bio,
        avatarUri: avatarUri === creator.data.avatarUri ? null : avatarUri,
      });
      await client.sendTransaction([instruction]);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border-t border-black/20 pt-6">
      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("displayName")}
      </label>
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        maxLength={64}
        className="field mb-4 w-full px-3 py-2.5 text-sm"
      />

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("bio")}
      </label>
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        maxLength={200}
        rows={3}
        className="field mb-4 w-full resize-none px-3 py-2.5 text-sm"
      />

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("avatarUrl")} <span className="text-mist-600">{t("optional")}</span>
      </label>
      <input
        value={avatarUri}
        onChange={(event) => setAvatarUri(event.target.value)}
        maxLength={200}
        className="field mb-5 w-full px-3 py-2.5 text-sm"
        placeholder="https://…"
      />

      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || busy}
        className="btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
      >
        {busy ? t("saving") : t("saveChanges")}
      </button>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateGoalForm({
  creator,
  nextIndex,
  onCreated,
}: {
  creator: Address;
  nextIndex: bigint;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("5");
  const [tokenMint, setTokenMint] = useState(SUPPORTED_TOKENS[0].mint);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const token = tokenFor(tokenMint);
  const targetAmount = parseTokenAmount(target, token.decimals);

  // <input type="date"> gives a local calendar day; the program wants a Unix
  // second, and the deadline should be the end of that day rather than
  // midnight at its start.
  const deadline = (() => {
    if (!deadlineDate) return null;
    const parsed = new Date(`${deadlineDate}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) return null;
    return BigInt(Math.floor(parsed.getTime() / 1000));
  })();

  const deadlineInPast =
    deadline !== null && deadline <= BigInt(Math.floor(Date.now() / 1000));

  const valid =
    title.trim().length > 0 &&
    targetAmount !== null &&
    targetAmount > 0n &&
    !deadlineInPast;

  async function submit() {
    if (!connected?.signer || targetAmount === null) return;
    setBusy(true);
    setError(undefined);
    try {
      const goal = await findGoalPda(creator, nextIndex);
      const shared = {
        creator,
        goal,
        owner: connected.signer,
        title: title.trim(),
        description: description.trim(),
        target: targetAmount,
        deadline,
      };

      const instruction = isNativeMint(tokenMint)
        ? await createGoal(shared)
        : await createTokenGoal({ ...shared, mint: tokenMint });

      await client.sendTransaction([instruction]);
      setTitle("");
      setDescription("");
      setDeadlineDate("");
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("couldNotCreate"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary w-full px-4 py-3 text-xs font-bold uppercase tracking-[0.08em]"
      >
        {t("newGoal")}
      </button>
    );
  }

  return (
    <div className="card border-black/30 p-6 sm:p-8">
      <p className="eyebrow text-grape-400">{t("newEntry")}</p>
      <h2 className="display mb-6 mt-2 text-4xl">{t("newGoal")}</h2>

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("title")}
      </label>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
        className="field mb-4 w-full px-3 py-2.5 text-sm"
        placeholder={t("goalTitlePlaceholder")}
      />

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("description")}
      </label>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={280}
        rows={2}
        className="field mb-4 w-full resize-none px-3 py-2.5 text-sm"
        placeholder={t("goalDescriptionPlaceholder")}
      />

      {SUPPORTED_TOKENS.length > 1 && (
        <>
          <label className="mb-1.5 block text-xs font-medium text-mist-500">
            {t("denomination")}
          </label>
          <div className="mb-4 flex gap-2">
            {SUPPORTED_TOKENS.map((option) => (
              <button
                key={option.mint}
                type="button"
                onClick={() => setTokenMint(option.mint)}
                className={`flex-1 border px-3 py-2 font-mono text-xs font-bold transition-colors ${
                  tokenMint === option.mint
                    ? "border-grape-500 bg-grape-500 text-white"
                    : "border-black/20 text-mist-500 hover:border-black hover:text-mist-100"
                }`}
              >
                {option.symbol}
              </button>
            ))}
          </div>
          <p className="mb-4 -mt-2 text-xs leading-relaxed text-mist-600">
            {isNativeMint(tokenMint)
              ? t("solMoves")
              : t("tokenFixed", { symbol: token.symbol })}
          </p>
        </>
      )}

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("target", { symbol: token.symbol })}
      </label>
      <input
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        inputMode="decimal"
        className="field mb-4 w-full px-3 py-2.5 text-sm"
      />

      <label className="mb-1.5 block text-xs font-medium text-mist-500">
        {t("deadline")} <span className="text-mist-600">{t("optional")}</span>
      </label>
      <input
        type="date"
        value={deadlineDate}
        onChange={(event) => setDeadlineDate(event.target.value)}
        className="field mb-1.5 w-full px-3 py-2.5 text-sm"
      />
      {deadlineInPast ? (
        <p className="mb-4 text-xs text-ember-400">
          {t("futureDeadline")}
        </p>
      ) : (
        <p className="mb-5 text-xs text-mist-600">
          {t("deadlineBody")}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!valid || busy}
          className="btn-primary flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {busy ? t("creating") : t("createGoal")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.06em]"
        >
          {t("cancel")}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function GoalRow({
  goal,
  handle,
  onChanged,
}: {
  goal: WithAddress<Goal>;
  handle: string;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();
  const rpc = client.rpc as unknown as KadiRpc;

  const [busy, setBusy] = useState<
    "claim" | "archive" | "complete" | null
  >(null);
  const [signature, setSignature] = useState<string>();
  const [error, setError] = useState<string>();

  const data = goal.data;
  const token = tokenFor(data.mint);
  const native = isNativeMint(data.mint);

  const claimable = useAsync(
    () =>
      native
        ? fetchClaimable(rpc, goal.address)
        : fetchTokenClaimable(rpc, goal.address, data.mint),
    [client, goal.address, native, data.mint, signature]
  );

  async function claim() {
    if (!connected?.signer) return;
    setBusy("claim");
    setError(undefined);
    try {
      const instruction = native
        ? await claimSol({
            goal: goal.address,
            owner: connected.signer,
            amount: null, // everything above the rent floor
          })
        : await claimToken({
            goal: goal.address,
            owner: connected.signer,
            mint: data.mint,
            amount: null,
          });
      const result = await client.sendTransaction([instruction]);
      setSignature(result.context.signature);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("claimFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(status: GoalStatus, label: "archive" | "complete") {
    if (!connected?.signer) return;
    setBusy(label);
    setError(undefined);
    try {
      const instruction = setGoalStatus({
        goal: goal.address,
        owner: connected.signer,
        status,
      });
      await client.sendTransaction([instruction]);
      onChanged();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Could not ${label} the goal`
      );
    } finally {
      setBusy(null);
    }
  }

  const available = claimable.data ?? 0n;

  return (
    <div className="card border-black/25 p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/goal/${handle}/${data.index}`}
            className="display text-2xl leading-none hover:text-grape-400"
          >
            {data.title}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill status={data.status} />
            <span className="text-xs text-mist-600">
              {data.donationCount.toString()} {t("donations")} ·{" "}
              {data.supporterCount.toString()} {t("supporters")}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {formatTokenAmount(data.raised, token.decimals)}{" "}
            <span className="font-normal text-mist-500">
              / {formatTokenAmount(data.target, token.decimals)} {token.symbol}
            </span>
          </p>
          <p className="text-xs text-mist-600">
            {formatTokenAmount(data.claimed, token.decimals)} {token.symbol}{" "}
            {t("claimed")}
          </p>
        </div>
      </div>

      <ProgressBar raised={data.raised} target={data.target} className="mb-4" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-mist-500">{t("available")} </span>
          <span className="font-semibold text-mint-300">
            {formatTokenAmount(available, token.decimals)} {token.symbol}
          </span>
        </p>

        <div className="flex gap-2">
          {data.status === GoalStatus.Active && (
            <>
              <button
                type="button"
                onClick={() =>
                  void changeStatus(GoalStatus.Archived, "archive")
                }
                disabled={busy !== null}
                className="border border-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-mist-400 hover:border-black disabled:opacity-50"
              >
                {busy === "archive" ? "…" : t("archive")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void changeStatus(GoalStatus.Completed, "complete")
                }
                disabled={busy !== null}
                className="border border-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-mist-400 hover:border-black disabled:opacity-50"
              >
                {busy === "complete" ? "…" : t("markDone")}
              </button>
            </>
          )}
          {data.status !== GoalStatus.Active && (
            <button
              type="button"
              onClick={() => void changeStatus(GoalStatus.Active, "archive")}
              disabled={busy !== null}
              className="border border-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-mist-400 hover:border-black disabled:opacity-50"
            >
              {busy === "archive" ? "…" : t("reopen")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void claim()}
            disabled={busy !== null || available === 0n}
            className="btn-primary px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em]"
          >
            {busy === "claim" ? t("claiming") : t("claim")}
          </button>
        </div>
      </div>

      {signature && (
        <p className="mt-3 text-xs text-mint-300">
          {t("claimed")} ·{" "}
          <a
            href={explorerTx(signature)}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {t("viewTransaction")}
          </a>
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs leading-relaxed text-ember-400">{error}</p>
      )}
    </div>
  );
}

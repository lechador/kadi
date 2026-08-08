"use client";

import type { ProfileView } from "@/lib/views";

/// Social links, rebuilt from stored identities rather than stored URLs.
///
/// The database keeps `nikoloz`, not `https://x.com/nikoloz`, so a creator
/// cannot point a "Twitch" badge at an arbitrary destination — the host is
/// ours to choose and the handle is all they supply. `website` is the one
/// free-form URL, and it is normalised to http(s) before it is stored.

const NETWORKS: {
  key: keyof ProfileView;
  label: string;
  href: (handle: string) => string;
}[] = [
  { key: "twitter", label: "X", href: (h) => `https://x.com/${h}` },
  { key: "youtube", label: "YouTube", href: (h) => `https://youtube.com/@${h}` },
  { key: "twitch", label: "Twitch", href: (h) => `https://twitch.tv/${h}` },
  {
    key: "instagram",
    label: "Instagram",
    href: (h) => `https://instagram.com/${h}`,
  },
  { key: "tiktok", label: "TikTok", href: (h) => `https://tiktok.com/@${h}` },
];

export function CreatorSocials({ profile }: { profile: ProfileView | null }) {
  if (!profile) return null;

  const links = NETWORKS.filter((network) => profile[network.key]).map(
    (network) => ({
      label: network.label,
      href: network.href(String(profile[network.key])),
    })
  );

  if (profile.website) {
    links.unshift({
      label: new URL(profile.website).hostname.replace(/^www\./, ""),
      href: profile.website,
    });
  }

  if (links.length === 0 && !profile.discord) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer nofollow"
          className="border border-black/20 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-mist-500 transition-colors hover:border-black hover:text-mist-100"
        >
          {link.label}
        </a>
      ))}
      {profile.discord && (
        // Shown, not linked: a Discord value can be a username or an invite
        // code, and guessing wrong sends people somewhere unintended.
        <span className="border border-dashed border-black/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
          Discord: {profile.discord}
        </span>
      )}
    </div>
  );
}

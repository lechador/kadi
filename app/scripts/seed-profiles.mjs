#!/usr/bin/env node
// Demo profiles for the three seeded creators.
//
// The chain seed (`npm run seed` at the repo root) creates the creators, goals
// and donations. It cannot create these, because banners, socials and
// categories are the off-chain half of a creator page — they live in Postgres
// by design, and nothing about them is derivable from the ledger.
//
// Kept as a script rather than a migration: this is demo content, and a
// migration that inserts fake creators into a real database is a trap waiting
// for whoever runs it in production.
//
//   node scripts/seed-profiles.mjs

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function loadEnvLocal() {
  try {
    const text = await readFile(join(here, "..", ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // The variables may come from the shell instead.
  }
}

const PROFILES = {
  nikoloz_live: {
    category: "streaming",
    location: "თბილისი",
    about:
      "CS2 და გვიანი ღამის საუბრები. სტრიმი ოთხშაბათიდან კვირამდე, 21:00-დან.\n\nმიზნები, რომლებსაც აქ ხედავთ, აღჭურვილობაზეა — ყველა დონაცია პირდაპირ საცავში მიდის და ბლოკჩეინზე ჩანს.",
    website: "https://kadi.ge",
    twitter: "nikoloz",
    twitch: "nikoloz",
    accent: "#8b5cf6",
  },
  tako_arts: {
    category: "art",
    location: "ბათუმი",
    about:
      "ციფრული ილუსტრაცია — ძირითადად ქართული ფოლკლორი. ყოველ შაბათს ვხატავ პირდაპირ ეთერში და ვხსნი, რას როგორ ვაკეთებ.",
    twitter: "tako_arts",
    instagram: "tako.arts",
    accent: "#2ee6a0",
  },
  kartuli_chess: {
    category: "sport",
    location: "ქუთაისი",
    about:
      "ვარჯიში და ტურნირების კომენტირება, ქართულად. ბავშვების მომზადება საერთაშორისო ტურნირებისთვის.",
    youtube: "kartulichess",
    twitter: "kartulichess",
    accent: "#46d7f0",
  },
};

const FIELDS = [
  "banner_url",
  "avatar_url",
  "about",
  "category",
  "location",
  "website",
  "twitter",
  "youtube",
  "twitch",
  "instagram",
  "tiktok",
  "discord",
  "accent",
];

const CAMEL = {
  banner_url: "bannerUrl",
  avatar_url: "avatarUrl",
};

async function main() {
  await loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    let written = 0;
    for (const [handle, profile] of Object.entries(PROFILES)) {
      // The creator has to be indexed first — its PDA is the profile's key.
      const { rows } = await client.query(
        "select address, owner from creators where handle = $1",
        [handle]
      );
      if (rows.length === 0) {
        console.log(`skipped @${handle} — not indexed yet, run /api/sync first`);
        continue;
      }

      const { address, owner } = rows[0];
      const values = FIELDS.map(
        (field) => profile[CAMEL[field] ?? field] ?? null
      );

      await client.query(
        `insert into creator_profiles (creator_address, owner, ${FIELDS.join(", ")})
         values ($1, $2, ${FIELDS.map((_, i) => `$${i + 3}`).join(", ")})
         on conflict (creator_address) do update set
           ${FIELDS.map((f) => `${f} = excluded.${f}`).join(",\n           ")},
           updated_at = now()`,
        [address, owner, ...values]
      );

      console.log(`wrote profile for @${handle}`);
      written += 1;
    }
    console.log(`\n${written} profile${written === 1 ? "" : "s"} seeded`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

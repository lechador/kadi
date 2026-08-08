#!/usr/bin/env node
// Applies every unapplied file in migrations/ in filename order.
//
// Deliberately plain node-postgres rather than the driver split the app uses:
// migrations run once, from a shell, and Neon accepts the same TCP connection
// string that a local Postgres does. One code path, no environment branch.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");

// The app reads app/.env.local; a bare `node` process does not. Load it so
// `npm run db:migrate` needs no exported environment.
async function loadEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await readFile(join(here, "..", file), "utf8");
      for (const line of text.split("\n")) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key] !== undefined) continue;
        process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      // A missing env file is normal — the variables may come from the shell.
    }
  }
}

async function main() {
  await loadEnvLocal();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set.\n" +
        "Create a Neon project at https://neon.tech, copy its connection\n" +
        "string, and put it in app/.env.local as:\n\n" +
        "  DATABASE_URL=postgresql://user:password@host.neon.tech/db?sslmode=require\n"
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.query("select name from _migrations")).rows.map(
        (row) => row.name
      )
    );

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const name of files) {
      if (applied.has(name)) continue;

      const sql = await readFile(join(migrationsDir, name), "utf8");
      // Each migration is one transaction: it either lands whole or not at all,
      // and a failure leaves the ledger of applied migrations honest.
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${name} failed: ${error.message}`, { cause: error });
      }

      console.log(`applied ${name}`);
      ran += 1;
    }

    console.log(
      ran === 0
        ? `up to date (${files.length} migration${files.length === 1 ? "" : "s"})`
        : `applied ${ran} migration${ran === 1 ? "" : "s"}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

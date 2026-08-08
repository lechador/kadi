// Generates a @solana/kit-native client (instruction builders, account
// decoders and PDA finders) from the Anchor IDL. Run automatically before
// `dev` and `build`, so the frontend can never drift from the program's
// on-chain interface.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const idlPath = resolve(appRoot, "../target/idl/kadi.json");
const outDir = resolve(appRoot, "src/generated");
const tmpDir = resolve(appRoot, ".codama-tmp");

// The generated client is committed, so a missing IDL is only fatal when there
// is nothing to fall back on. This matters on hosts that build from the `app/`
// directory alone (Vercel's Root Directory setting excludes ../target by
// default) — there the committed output is exactly what should be used.
if (!existsSync(idlPath)) {
  if (existsSync(resolve(outDir, "index.ts"))) {
    console.log("  IDL not present — using the committed client in src/generated");
    process.exit(0);
  }
  console.error(
    `\n  Anchor IDL not found at ${idlPath}, and src/generated is empty.\n` +
      `  Build the program first:  npm --prefix .. run build:program\n`
  );
  process.exit(1);
}

const idl = JSON.parse(readFileSync(idlPath, "utf8"));

// renderVisitor lays out a complete publishable package (package.json plus
// src/generated/**). Only the module tree is wanted here, so it is rendered to
// a scratch directory and the inner folder is lifted into src/generated.
rmSync(tmpDir, { recursive: true, force: true });
const codama = createFromRoot(rootNodeFromAnchor(idl));
// renderVisitor writes asynchronously; awaiting is required before the output
// can be moved.
await codama.accept(renderVisitor(tmpDir));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(resolve(tmpDir, "src/generated"), outDir, { recursive: true });
rmSync(tmpDir, { recursive: true, force: true });

// Codama renders instructions and accounts but not event layouts, so the raw
// IDL is kept alongside — the overlay reads event discriminators from here
// rather than hard-coding hashes that would silently rot.
writeFileSync(resolve(outDir, "idl.json"), JSON.stringify(idl, null, 2));

console.log(`  generated Kit client -> ${outDir}`);

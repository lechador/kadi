// Emits target/types/kadi.ts from the built IDL.
//
// Normally `anchor build` does this, but this workspace builds the SBF binary
// with an explicit --tools-version (see build-program.sh), and that flag is not
// accepted by the host-side cargo invocation Anchor uses for IDL extraction. So
// the two steps are run separately and this fills in the last artifact.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const idl = JSON.parse(
  readFileSync(resolve(root, "target/idl/kadi.json"), "utf8")
);

const name = idl.metadata.name;
const typeName = name.charAt(0).toUpperCase() + name.slice(1);

/// Anchor's own type emitter rewrites every `name` in the IDL to camelCase,
/// because that is what the JS client exposes at runtime
/// (`program.methods.donateSol`, not `donate_sol`). Type references such as
/// `{"defined":{"name":"GoalStatus"}}` are renamed by the same pass, so
/// definitions and references stay in agreement.
function toCamelCase(value) {
  const [head, ...rest] = value.split("_");
  return (
    head.charAt(0).toLowerCase() +
    head.slice(1) +
    rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")
  );
}

function camelCaseNames(node) {
  if (Array.isArray(node)) return node.map(camelCaseNames);
  if (node === null || typeof node !== "object") return node;

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === "name" && typeof value === "string"
        ? toCamelCase(value)
        : camelCaseNames(value),
    ])
  );
}

const body = JSON.stringify(
  { ...camelCaseNames(idl), address: idl.address, metadata: idl.metadata },
  null,
  2
);

const contents = `/**
 * Generated from target/idl/${name}.json — do not edit by hand.
 * Regenerate with: npm run build:program
 */
export type ${typeName} = ${body};
`;

mkdirSync(resolve(root, "target/types"), { recursive: true });
writeFileSync(resolve(root, `target/types/${name}.ts`), contents);
console.log(`  wrote target/types/${name}.ts`);

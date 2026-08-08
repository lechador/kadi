#!/usr/bin/env bash
#
# Builds the Kadi program and every artifact the clients depend on.
#
# Why this isn't just `anchor build`:
#
# The Solana CLI currently ships platform-tools v1.48, whose bundled rustc is
# 1.84 — too old for the edition2024 manifests that several transitive Solana
# dependencies now use. PLATFORM_TOOLS_VERSION below pins a toolchain that is
# new enough. That flag is only understood by cargo-build-sbf, not by the
# host-side cargo invocation Anchor uses to extract the IDL, so the SBF build
# and the IDL build are run as separate steps.
set -euo pipefail

PLATFORM_TOOLS_VERSION="${PLATFORM_TOOLS_VERSION:-v1.54}"
cd "$(dirname "$0")/.."

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

echo "==> building SBF binary (platform-tools ${PLATFORM_TOOLS_VERSION})"
anchor build --no-idl -- --tools-version "${PLATFORM_TOOLS_VERSION}"

echo "==> building IDL"
mkdir -p target/idl
anchor idl build -o target/idl/kadi.json

echo "==> generating TypeScript types"
node scripts/gen-types.mjs

echo "==> done"
ls -la target/deploy/kadi.so target/idl/kadi.json target/types/kadi.ts

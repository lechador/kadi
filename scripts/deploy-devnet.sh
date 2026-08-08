#!/usr/bin/env bash
#
# Deploys Kadi to devnet and initialises the protocol config.
#
#   npm run devnet:deploy
#
# Devnet SOL: the CLI faucet (`solana airdrop 2 --url devnet`) is aggressively
# rate-limited and is frequently dry. If it fails, use https://faucet.solana.com
# which requires a GitHub sign-in. Deploying a program of this size needs
# roughly 4 SOL; --max-len below keeps that as low as possible by not reserving
# spare room for future upgrades.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

if [ ! -f target/deploy/kadi.so ]; then
  npm run build:program
fi

PROGRAM_SIZE=$(wc -c < target/deploy/kadi.so | tr -d ' ')
ADDRESS=$(solana address)
BALANCE=$(solana balance --url devnet | awk '{print $1}')

echo "wallet   $ADDRESS"
echo "balance  ${BALANCE} SOL (devnet)"
echo "program  ${PROGRAM_SIZE} bytes"

if awk "BEGIN{exit !($BALANCE < 4)}"; then
  cat <<EOF

  Not enough devnet SOL to deploy (need ~4).

  Try:   solana airdrop 2 --url devnet
  Or:    https://faucet.solana.com   (sign in with GitHub, paste $ADDRESS)

EOF
  exit 1
fi

echo "==> deploying to devnet"
solana program deploy \
  --url devnet \
  --program-id target/deploy/kadi-keypair.json \
  --max-len "$PROGRAM_SIZE" \
  target/deploy/kadi.so

echo "==> initialising protocol config"
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET="$HOME/.config/solana/id.json" \
  npx ts-node --compilerOptions '{"module":"commonjs"}' scripts/seed.ts

cat <<'EOF'

  Deployed. Point the app at devnet in app/.env.local:

    NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
    NEXT_PUBLIC_SOLANA_WS_URL=wss://api.devnet.solana.com
    NEXT_PUBLIC_SOLANA_CHAIN=solana:devnet
    NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

  A public RPC will rate-limit getProgramAccounts; for anything shared, use a
  Helius or Triton endpoint instead.

EOF

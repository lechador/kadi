#!/usr/bin/env bash
#
# One command to get a fully working Kadi: validator, program, demo data.
#
#   npm run localnet:up
#
# Leaves the validator running in the background (logs in test-ledger/). Stop it
# with `npm run localnet:down`.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

RPC="http://127.0.0.1:8899"

if [ ! -f target/deploy/kadi.so ]; then
  echo "==> program not built yet"
  npm run build:program
fi

if curl -s -m 2 -X POST "$RPC" -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' >/dev/null 2>&1; then
  echo "==> validator already running"
else
  echo "==> starting validator"
  mkdir -p test-ledger
  # The default retention is 10,000 shreds — about forty minutes of an idle
  # validator's slots. Once those slots are purged `getSignaturesForAddress`
  # returns nothing, and the goal page's donation ledger silently empties even
  # though the accounts are still there. Raising it keeps a working session's
  # history queryable. (Indexed donations survive the purge either way; this is
  # about the first sync still having something to read.)
  nohup solana-test-validator --reset --quiet \
    --limit-ledger-size 10000000 \
    > test-ledger/validator.log 2>&1 &
  echo "    waiting for it to come up…"
  for _ in $(seq 1 60); do
    if curl -s -m 2 -X POST "$RPC" -H 'Content-Type: application/json' \
         -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

echo "==> funding the deploy wallet"
solana config set -u "$RPC" >/dev/null
solana airdrop 100 >/dev/null 2>&1 || true

echo "==> deploying"
anchor deploy

echo "==> seeding demo data"
npm run seed

cat <<'EOF'

  Ready.

    cd app && npm run dev

  Then open http://localhost:3000
  Creator pages:  /c/nikoloz_live  /c/tako_arts  /c/kartuli_chess
  OBS overlay:    /overlay/nikoloz_live?test=1

  Fire a live donation (watch the overlay):  npm run seed -- --donate

EOF

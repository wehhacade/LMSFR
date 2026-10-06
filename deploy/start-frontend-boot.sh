#!/usr/bin/env bash
# Boot helper: prefer systemd --user service; fall back to direct next start.
set -euo pipefail
export PATH="/home/dev/.nvm/versions/node/v22.23.2/bin:/usr/local/bin:/usr/bin:/bin"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
ROOT="/var/www/html/lmsbr-v3"
LOG="$ROOT/frontend.log"

# If already listening, done
if ss -tln | rg -q ':3000\b'; then
  exit 0
fi

if systemctl --user start lmsbr-frontend.service 2>/dev/null; then
  sleep 2
  if ss -tln | rg -q ':3000\b'; then
    exit 0
  fi
fi

cd "$ROOT/frontend"
exec nohup npm run start -- -H 127.0.0.1 -p 3000 >>"$LOG" 2>&1

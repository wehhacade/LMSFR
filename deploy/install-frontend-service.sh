#!/usr/bin/env bash
# Install LMSBR frontend as a systemd service (auto-restart + boot).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_SRC="$ROOT/deploy/lmsbr-frontend.service"
UNIT_DST="/etc/systemd/system/lmsbr-frontend.service"

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Missing $UNIT_SRC" >&2
  exit 1
fi

# Stop ad-hoc next processes so the service owns :3000
pkill -u "$(id -un)" -f 'next-server|next start' 2>/dev/null || true
rm -f "$ROOT/.frontend.pid"
sleep 1

sudo cp "$UNIT_SRC" "$UNIT_DST"
sudo systemctl daemon-reload
sudo systemctl enable --now lmsbr-frontend.service
sudo systemctl --no-pager --full status lmsbr-frontend.service || true

echo ""
echo "Installed. Useful commands:"
echo "  sudo systemctl status lmsbr-frontend"
echo "  sudo systemctl restart lmsbr-frontend"
echo "  sudo journalctl -u lmsbr-frontend -f"

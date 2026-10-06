#!/usr/bin/env bash
# Apply TipPhone Apache exception only (/api/tiphone → Next.js :3000).
# Does not change /api/v3, /admin, /static, /media, or the Next catch-all.
# Usage: sudo bash /var/www/html/lmsbr-v3/deploy/apply-tiphone-apache.sh
set -euo pipefail

CONF="/etc/apache2/sites-available/000-default.conf"

if grep -q 'ProxyPass /api/tiphone' "$CONF"; then
  echo "TipPhone ProxyPass already present — reload only"
else
  python3 - <<'PY'
from pathlib import Path
path = Path("/etc/apache2/sites-available/000-default.conf")
text = path.read_text()
needle = """        # Django API / admin / static / media
        ProxyPass /api/ http://127.0.0.1:8000/api/
        ProxyPassReverse /api/ http://127.0.0.1:8000/api/
"""
insert = """        # TipPhone PWA (Next.js) — must be before /api/ → Django
        ProxyPass /api/tiphone http://127.0.0.1:3000/api/tiphone
        ProxyPassReverse /api/tiphone http://127.0.0.1:3000/api/tiphone

        # Django API / admin / static / media
        ProxyPass /api/ http://127.0.0.1:8000/api/
        ProxyPassReverse /api/ http://127.0.0.1:8000/api/
"""
if needle not in text:
    raise SystemExit("Could not find /api/ ProxyPass block to patch")
path.write_text(text.replace(needle, insert, 1))
print("Patched", path)
PY
fi

apache2ctl configtest
systemctl reload apache2
echo "OK — apache2 reloaded"
echo "--- /api/tiphone ---"
curl -sI -H "Host: lmsbr.com" "http://127.0.0.1/api/tiphone" | head -8
echo "--- /api/v3/ (should still be Django) ---"
curl -sI -H "Host: lmsbr.com" "http://127.0.0.1/api/v3/" | head -6

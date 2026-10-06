#!/usr/bin/env bash
#
# Make the LMSBR v3 API reachable from the public internet (mobile data, any network).
#
# Run on the EC2 host:
#   sudo bash /var/www/html/lmsbr-v3/deploy/enable-public-api.sh
#
# AWS PREREQUISITES (console/CLI — cannot be done from inside the instance):
#   1. Security group "oisec2": allow inbound TCP 80 and 443 from 0.0.0.0/0
#   2. DNS A record: api.lmsbr.com -> 18.181.105.119
#      (lmsbr.com itself points at an ALB that routes elsewhere, so the API
#       needs its own name pointing straight at this instance.)
#
# Verify DNS has propagated before running:
#   dig +short api.lmsbr.com     # must return 18.181.105.119

set -euo pipefail

REPO_DIR="/var/www/html/lmsbr-v3"
API_DOMAIN="${API_DOMAIN:-api.lmsbr.com}"
CERT_EMAIL="${CERT_EMAIL:-admin@lmsbr.com}"

echo "==> Enabling Apache modules"
a2enmod proxy proxy_http headers rewrite ssl

echo "==> Installing Apache reverse proxy vhost"
cp "${REPO_DIR}/deploy/apache-lmsbr.com.conf" /etc/apache2/sites-available/000-default.conf
apache2ctl configtest
systemctl reload apache2

echo "==> Checking that ${API_DOMAIN} resolves to this instance"
resolved="$(getent hosts "${API_DOMAIN}" | awk '{print $1}' | head -1 || true)"
public_ip="$(curl -s --max-time 5 https://checkip.amazonaws.com || true)"
if [ "${resolved}" != "${public_ip}" ]; then
    echo "!! ${API_DOMAIN} resolves to '${resolved:-nothing}' but this host is '${public_ip}'."
    echo "!! Fix the DNS A record first, then re-run. Skipping certificate step."
    exit 1
fi

echo "==> Installing certbot"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-apache

echo "==> Requesting Let's Encrypt certificate for ${API_DOMAIN}"
certbot --apache --non-interactive --agree-tos \
    --email "${CERT_EMAIL}" \
    --domains "${API_DOMAIN}" \
    --redirect

systemctl reload apache2

echo
echo "Done. Public API base URL for the mobile app:"
echo "    https://${API_DOMAIN}/api/v3"
echo
echo "Smoke test from any network:"
echo "    curl https://${API_DOMAIN}/api/v3/health/"

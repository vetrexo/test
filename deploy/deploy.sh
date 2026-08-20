#!/usr/bin/env bash
# Run on the droplet, from /home/deploy/inventory-app, as the deploy user:
#   ./deploy/deploy.sh
set -euo pipefail

git pull origin main
npm ci
npm run build
sudo systemctl restart inventory-app
sudo systemctl status inventory-app --no-pager -l

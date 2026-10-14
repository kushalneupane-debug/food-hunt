#!/usr/bin/env bash
# Redeploy the latest main branch on the EC2 server.
# Usage (on the EC2 server):  ~/food-hunt/deploy/update.sh
set -euo pipefail
cd "$HOME/food-hunt"
git pull --ff-only
sudo docker compose -f docker-compose.prod.yml up -d --build
sudo docker image prune -f >/dev/null
echo "Updated. Check: curl -s localhost/api/health"

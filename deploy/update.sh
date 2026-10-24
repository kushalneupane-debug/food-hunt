#!/usr/bin/env bash
# Redeploy the latest main branch on the EC2 server.
# Usage (on the EC2 server):  ~/food-hunt/deploy/update.sh
set -euo pipefail
cd "$HOME/food-hunt"
COMPOSE="sudo docker compose -f docker-compose.prod.yml"

git pull --ff-only

# Secrets added by newer features (kept only on this server, never in Git).
if ! grep -Eq '^JWT_SECRET=.+$' .env; then
  echo "==> Adding JWT_SECRET for login tokens"
  printf '\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
  chmod 600 .env
fi

$COMPOSE up -d --build

# MySQL only runs schema.sql when the database is first created, so new tables
# never reach an existing database by themselves. Apply every
# "CREATE TABLE IF NOT EXISTS" block from schema.sql: safe to run repeatedly,
# and it never touches existing tables or data.
echo "==> Applying new tables to the existing database"
awk '/CREATE TABLE IF NOT EXISTS/,/;/' server/db/schema.sql |
  $COMPOSE exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot foodhunt'

# Column changes to existing tables (e.g. users.phone) live in server/db/migrate.js.
# It checks before altering, so running it on every deploy is safe.
echo "==> Running database migrations"
$COMPOSE exec -T app node db/migrate.js

# Real Texarkana places (OpenStreetMap) and checked dishes. Updates in place; removes sample places.
echo "==> Importing real places"
$COMPOSE exec -T app node db/import-places.js

sudo docker image prune -f >/dev/null
echo "Updated. Check: curl -s localhost/api/health"

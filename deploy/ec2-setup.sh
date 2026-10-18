#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 EC2 instance.
# Run this script on the EC2 server.
set -euo pipefail

REPO_URL="https://github.com/kushalneupane-debug/food-hunt.git"
APP_DIR="$HOME/food-hunt"

echo "==> 1/5 Adding 2 GB swap"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' |
    sudo tee -a /etc/fstab >/dev/null
fi

echo "==> 2/5 Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi

echo "==> 3/5 Getting the code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

echo "==> 4/5 Preparing private environment settings"

# Create database passwords only for a new installation.
# Preserve existing passwords so the database remains accessible.
if [ ! -f .env ]; then
  (
    umask 077
    {
      printf 'MYSQL_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 16)"
      printf 'MYSQL_PASSWORD=%s\n' "$(openssl rand -hex 16)"
    } > .env
  )
fi

# Preserve an existing JWT secret, or generate one if missing.
if ! grep -Eq '^JWT_SECRET=.+$' .env; then
  printf '\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
fi

chmod 600 .env

echo "==> 5/5 Building and starting the app"
sudo docker compose -f docker-compose.prod.yml up -d --build

PUBLIC_IP=$(
  curl -fs --max-time 3 https://checkip.amazonaws.com ||
    echo "<your-ec2-public-ip>"
)

echo
echo "Done. Allow MySQL time to finish starting, then open:"
echo "  http://$PUBLIC_IP/"
echo "  http://$PUBLIC_IP/api/health"
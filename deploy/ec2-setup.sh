#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 EC2 instance.
# Usage (on the EC2 server):
#   curl -fsSL https://raw.githubusercontent.com/kushalneupane-debug/food-hunt/main/deploy/ec2-setup.sh | bash
set -euo pipefail

REPO_URL="https://github.com/kushalneupane-debug/food-hunt.git"
APP_DIR="$HOME/food-hunt"

echo "==> 1/5 Adding 2 GB swap (small instances run out of RAM during the build)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
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

echo "==> 4/5 Creating database passwords (kept only on this server)"
if [ ! -f .env ]; then
  {
    echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)"
    echo "MYSQL_PASSWORD=$(openssl rand -hex 16)"
  } > .env
  chmod 600 .env
fi

echo "==> 5/5 Building and starting the app (first run takes 3-6 minutes)"
sudo docker compose -f docker-compose.prod.yml up -d --build

PUBLIC_IP=$(curl -fs --max-time 3 https://checkip.amazonaws.com || echo "<your-ec2-public-ip>")
echo
echo "Done. Wait about 30 seconds for MySQL to start, then open:"
echo "  http://$PUBLIC_IP/"
echo "  http://$PUBLIC_IP/api/health"

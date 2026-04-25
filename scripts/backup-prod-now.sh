#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env.prod" ]; then
  echo ".env.prod not found. Copy .env.prod.example first." >&2
  exit 1
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T drft-backup sh /opt/drft-scripts/backup-once.sh

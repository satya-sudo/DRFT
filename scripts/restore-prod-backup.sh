#!/usr/bin/env sh

set -eu

if [ $# -lt 1 ]; then
  echo "Usage: sh scripts/restore-prod-backup.sh <backup-directory>" >&2
  exit 1
fi

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_DIR="$1"

cd "$ROOT_DIR"

if [ ! -f ".env.prod" ]; then
  echo ".env.prod not found. Copy .env.prod.example first." >&2
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

if [ ! -f "$BACKUP_DIR/postgres.dump" ] || [ ! -f "$BACKUP_DIR/storage.tar.gz" ]; then
  echo "Backup directory must contain postgres.dump and storage.tar.gz" >&2
  exit 1
fi

set -a
. ./.env.prod
set +a

STORAGE_PATH="${DRFT_STORAGE_PATH:-./data/storage}"

printf "This will overwrite production storage and database from %s\nType RESTORE to continue: " "$BACKUP_DIR" >&2
read -r CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore cancelled." >&2
  exit 1
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml stop drft-web drft-api drft-backup || true
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres

until docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-drft}" >/dev/null 2>&1; do
  sleep 2
done

mkdir -p "$STORAGE_PATH"
find "$STORAGE_PATH" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "$BACKUP_DIR/storage.tar.gz" -C "$STORAGE_PATH"

cat "$BACKUP_DIR/postgres.dump" | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres sh -c '
  cat > /tmp/drft-restore.dump &&
  pg_restore -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-drft}" --clean --if-exists --no-owner --no-privileges /tmp/drft-restore.dump &&
  rm -f /tmp/drft-restore.dump
'

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d drft-api drft-web drft-backup

echo "Restore completed from $BACKUP_DIR"

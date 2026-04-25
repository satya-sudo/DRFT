#!/usr/bin/env sh

set -eu

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required}"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
STORAGE_ROOT="${STORAGE_ROOT:-/var/lib/drft/storage}"
RETENTION_DAYS="${DRFT_BACKUP_RETENTION_DAYS:-7}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT%/}/${TIMESTAMP}"

mkdir -p "$TARGET_DIR"

echo "Creating DRFT backup in $TARGET_DIR"

pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  -f "$TARGET_DIR/postgres.dump"

tar -czf "$TARGET_DIR/storage.tar.gz" -C "$STORAGE_ROOT" .

{
  echo "timestamp=$TIMESTAMP"
  echo "postgres_host=$POSTGRES_HOST"
  echo "postgres_db=$POSTGRES_DB"
  echo "storage_root=$STORAGE_ROOT"
} > "$TARGET_DIR/manifest.txt"

sha256sum "$TARGET_DIR/postgres.dump" "$TARGET_DIR/storage.tar.gz" > "$TARGET_DIR/SHA256SUMS"

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup completed:"
echo "  $TARGET_DIR/postgres.dump"
echo "  $TARGET_DIR/storage.tar.gz"

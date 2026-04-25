#!/usr/bin/env sh

set -eu

INTERVAL_HOURS="${DRFT_BACKUP_INTERVAL_HOURS:-24}"
RUN_ON_START="${DRFT_BACKUP_RUN_ON_START:-true}"

if [ "$INTERVAL_HOURS" -le 0 ] 2>/dev/null; then
  echo "DRFT_BACKUP_INTERVAL_HOURS must be greater than 0" >&2
  exit 1
fi

if [ "$RUN_ON_START" = "true" ]; then
  sh /opt/drft-scripts/backup-once.sh
fi

INTERVAL_SECONDS=$((INTERVAL_HOURS * 3600))

while true; do
  sleep "$INTERVAL_SECONDS"
  sh /opt/drft-scripts/backup-once.sh
done

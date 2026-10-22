#!/usr/bin/env bash
# Checks backup export/restore on real SQLite files (Node >= 22.5, node:sqlite), with
# the app's own db/db.tsx and services/dataBackupService.ts. Never writes in the repo.
#
# Needs two real backups: an old partial one (no profile) and a full one. Defaults to the
# personal backups in the repo root (gitignored); pass other paths to use those instead.
#
# Usage: scripts/backup-check/run.sh [partial.json] [full.json]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
A="${1:-$ROOT/pagestreak-backup-2025-09-19T13-59-00.json}"
B="${2:-$ROOT/pagestreak-enhanced-backup-2025-09-19.json}"
for f in "$A" "$B"; do [ -f "$f" ] || { echo "Missing backup file: $f"; exit 1; }; done
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$ROOT/scripts/db-migration-check/expo-sqlite-shim.js" "$ROOT/scripts/backup-check/test.js" "$WORK/"
node "$ROOT/scripts/backup-check/build.js" "$ROOT" "$WORK"
cd "$WORK"
for scenario in onboarding-old onboarding-full merge merge-no-profile replace roundtrip invalid atomic; do
  node --no-warnings test.js "$scenario" "$A" "$B"
done
echo "All backup scenarios passed."

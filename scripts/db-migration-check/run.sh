#!/usr/bin/env bash
# Checks that db/db.tsx migrations upgrade real databases safely.
# Runs expo-sqlite's API on Node's built-in node:sqlite (Node >= 22.5) via a
# shim that mirrors expo-sqlite's transaction code. Never writes in the repo.
#
# Scenarios: fresh install; legacy `books`-only install; a DB created by the
# ORIGINAL app code (commit 2162355) with user data. Each is migrated, then
# migrated again with a concurrent init + transaction (the boot race found in
# Phase 5), then once more as a second launch.
#
# Usage: scripts/db-migration-check/run.sh
# When adding a migration, extend test.js with a fixture from the previous
# schema and the assertions the new migration should satisfy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$ROOT/scripts/db-migration-check/expo-sqlite-shim.js" "$ROOT/scripts/db-migration-check/test.js" "$WORK/"
node "$ROOT/scripts/db-migration-check/build.js" "$ROOT" "$WORK"
cd "$WORK"
for scenario in fresh legacy v3; do
  echo "== $scenario"
  node --no-warnings test.js "$scenario" setup
  node --no-warnings test.js "$scenario" migrate concurrent
  node --no-warnings test.js "$scenario" migrate
done
echo "All migration scenarios passed."

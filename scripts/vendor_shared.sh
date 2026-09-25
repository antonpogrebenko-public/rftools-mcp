#!/usr/bin/env bash
#
# Vendor the monorepo contracts this package's src/ and test/ need into
# vendor/, a committed directory, so a standalone checkout of this repository
# (what `.github/workflows/test.yml` tests, and what `npm publish` starts
# from) never has to read across `../shared` or `../frontend`.
#
# The Test workflow ran `npm test` in exactly that standalone shape on every
# push since 2.0.0 and failed every time: `src/job-schemas.ts` and three
# files under `test/` imported `../../shared/job-schemas/*.json`,
# `../../shared/result-provenance.schema.json` and a handful of
# `../../frontend/.../fixtures/*.json` files that only exist inside a
# checkout of the rfhub monorepo. CI checks out this repository alone, so
# those paths were ENOENT / ERR_MODULE_NOT_FOUND from the first push.
#
# This script is the monorepo-side half of the fix: it copies those files,
# byte for byte, into vendor/shared/ and vendor/frontend-fixtures/. src/ and
# test/ read the vendored copies unconditionally (so a standalone checkout
# works); this script (via `--check`, run from `scripts/build.sh --check`,
# which `pre-deploy-check.sh` runs) keeps the vendored copies from drifting
# out from under the monorepo's own sources.
#
# Usage:
#   bash scripts/vendor_shared.sh          # refresh vendor/
#   bash scripts/vendor_shared.sh --check  # fail if vendor/ differs from the monorepo
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
MONOREPO="$(cd "$HERE/.." && pwd)"
SHARED="$MONOREPO/shared"
JOB_SCHEMAS_SRC="$SHARED/job-schemas"
PROVENANCE_SRC="$SHARED/result-provenance.schema.json"
FIXTURES_SRC="$MONOREPO/frontend/src/components/async-tool/results/__tests__/fixtures"
VENDOR="$HERE/vendor"

# Only the fixtures test/results.test.js actually reads — vendoring every
# fixture in that directory would pull in tens of unrelated ones.
FIXTURE_NAMES=(
  sparam-4port.json
  antenna-sweep.json
  eye-lossy-line.json
  smps-subharmonic.json
  magnetics-verified.json
)

if [ ! -d "$JOB_SCHEMAS_SRC" ] || [ ! -f "$PROVENANCE_SRC" ]; then
  echo "This needs the rfhub monorepo: $SHARED is not the shared/ contract" >&2
  echo "directory, so there is nothing here to vendor from." >&2
  exit 1
fi

check_mode=0
[ "${1:-}" = "--check" ] && check_mode=1

fail=0

sync_or_check() {
  local src="$1" dst="$2"
  if [ "$check_mode" = 1 ]; then
    if [ ! -f "$dst" ]; then
      echo "missing vendored file: ${dst#"$HERE"/}" >&2
      fail=1
    elif ! cmp -s "$src" "$dst"; then
      echo "vendored file out of date: ${dst#"$HERE"/} (run: npm run vendor)" >&2
      fail=1
    fi
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
}

for src in "$JOB_SCHEMAS_SRC"/*.json; do
  sync_or_check "$src" "$VENDOR/shared/job-schemas/$(basename "$src")"
done

sync_or_check "$PROVENANCE_SRC" "$VENDOR/shared/result-provenance.schema.json"

if [ -d "$FIXTURES_SRC" ]; then
  for name in "${FIXTURE_NAMES[@]}"; do
    sync_or_check "$FIXTURES_SRC/$name" "$VENDOR/frontend-fixtures/$name"
  done
else
  echo "warning: $FIXTURES_SRC not found; leaving vendor/frontend-fixtures/ as is" >&2
fi

# A job type removed upstream must not leave a stale schema behind — the
# per-file loop above only catches one that's out of date, not one that
# should no longer exist.
if [ -d "$VENDOR/shared/job-schemas" ]; then
  for dst in "$VENDOR/shared/job-schemas"/*.json; do
    [ -e "$dst" ] || continue
    name="$(basename "$dst")"
    if [ ! -f "$JOB_SCHEMAS_SRC/$name" ]; then
      if [ "$check_mode" = 1 ]; then
        echo "stale vendored file with no source: ${dst#"$HERE"/} (run: npm run vendor)" >&2
        fail=1
      else
        rm -f "$dst"
      fi
    fi
  done
fi

if [ "$check_mode" = 1 ]; then
  if [ "$fail" = 1 ]; then
    exit 1
  fi
  echo "vendor/ matches ../shared (and the vendored frontend fixtures, where present)"
  exit 0
fi

n_schemas=$(find "$VENDOR/shared/job-schemas" -name '*.json' | wc -l | tr -d ' ')
n_fixtures=$(find "$VENDOR/frontend-fixtures" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
echo "vendored $n_schemas job schema(s), the provenance schema, and $n_fixtures frontend fixture(s) into vendor/"

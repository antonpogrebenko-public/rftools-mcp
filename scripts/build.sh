#!/usr/bin/env bash
#
# Build dist/mcp-server.cjs, the bundle this package publishes.
#
# The invocation used to live only in the monorepo's CLAUDE.md, which meant the
# one command that produces the shipped artefact was not in the repository that
# ships it. Anyone with a clone could edit `src/*.ts` and had no way to find out
# what turns them into the file `bin` points at.
#
# ── Why this needs the monorepo ──────────────────────────────────────────────
#
# `mcp-server.ts` imports `@/lib/calculators/registry` (the frontend's
# calculator definitions) and `src/job-schemas.ts` imports
# `../../shared/job-schemas/*.json` (the generated job contracts). Neither is in
# this repository: this package is a checkout of one directory of rfhub, and the
# bundle is how those definitions reach npm. So the build runs from the
# frontend, whose tsconfig resolves the `@` alias, and it can only run inside a
# full rfhub checkout.
#
# That is also why the drift check below runs in `scripts/pre-deploy-check.sh`
# at the monorepo root rather than in this repository's own CI, which never has
# the sources to rebuild from.
#
# Usage:
#   bash scripts/build.sh            # write dist/mcp-server.cjs
#   bash scripts/build.sh --check    # build to a temp file; fail if it differs
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$(cd "$HERE/.." && pwd)/frontend"
BUNDLE="$HERE/dist/mcp-server.cjs"

if [ ! -d "$FRONTEND/src/lib/calculators" ]; then
  echo "This build needs the rfhub monorepo: $FRONTEND is not a checkout of" >&2
  echo "the frontend, so '@/lib/calculators/registry' cannot be resolved." >&2
  exit 1
fi

build_to() {
  ( cd "$FRONTEND" && npx esbuild "$HERE/mcp-server.ts" \
      --bundle \
      --platform=node \
      --format=cjs \
      --outfile="$1" \
      --external:@modelcontextprotocol/sdk \
      --external:zod \
      --banner:js='#!/usr/bin/env node' \
      --alias:@=./src \
      --tsconfig=tsconfig.json )
}

if [ "${1:-}" = "--check" ]; then
  # Not under dist/: a leftover there is a file someone commits by accident.
  candidate="$(mktemp -t mcp-server-check)"
  trap 'rm -f "$candidate"' EXIT
  build_to "$candidate" >/dev/null

  if [ ! -f "$BUNDLE" ]; then
    echo "dist/mcp-server.cjs is missing. Run: npm run build" >&2
    exit 1
  fi
  if ! cmp -s "$BUNDLE" "$candidate"; then
    echo "dist/mcp-server.cjs is not what the sources produce." >&2
    echo "Run 'npm run build' in rftools-mcp and commit the result." >&2
    exit 1
  fi
  echo "dist/mcp-server.cjs matches its sources"
  exit 0
fi

mkdir -p "$HERE/dist"
build_to "$BUNDLE"
chmod +x "$BUNDLE"
echo "wrote dist/mcp-server.cjs"

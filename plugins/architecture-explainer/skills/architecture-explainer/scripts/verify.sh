#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo "architecture-explainer verification requires Apple Silicon macOS (arm64)" >&2
  exit 1
fi

before="$(mktemp)"
trap 'rm -f "$before"' EXIT
cp dist/architecture-explainer "$before"

bun run test
bun run typecheck
bun run build

if ! cmp -s "$before" dist/architecture-explainer; then
  echo "dist/architecture-explainer is stale; rebuild and commit the executable" >&2
  exit 1
fi

bun run smoke

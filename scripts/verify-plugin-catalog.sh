#!/usr/bin/env bash
# verify-plugin-catalog.sh — assert the root README plugin catalog lists exactly
# the plugins distributed by .claude-plugin/marketplace.json.
#
# A catalog row is a table row whose first cell links to ./plugins/<dir>/README.md.
# Plugins are matched by directory (the marketplace `source`), not display name.
# shellcheck shell=bash

set -euo pipefail
export SCRIPT_NAME="verify-plugin-catalog"
# shellcheck source=lib/version.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/version.sh"

require_cmd jq

README="$REPO_ROOT/README.md"
[[ -f "$README" ]] || die "README not found: $README"

marketplace_dirs="$(jq -r '.plugins[].source | ltrimstr("./")' "$MARKETPLACE_JSON" | LC_ALL=C sort -u)"
catalog_dirs="$(sed -nE 's#^\| *\[[^]]+\]\(\./(plugins/[^/)]+)/README\.md\).*#\1#p' "$README" | LC_ALL=C sort -u)"

fail=0

while IFS= read -r dir; do
  [[ -n "$dir" ]] || continue
  log error "$dir: distributed by .claude-plugin/marketplace.json but missing from the README plugin catalog"
  fail=1
done < <(LC_ALL=C comm -23 <(printf '%s\n' "$marketplace_dirs") <(printf '%s\n' "$catalog_dirs"))

while IFS= read -r dir; do
  [[ -n "$dir" ]] || continue
  log error "$dir: listed in the README plugin catalog but not distributed by .claude-plugin/marketplace.json"
  fail=1
done < <(LC_ALL=C comm -13 <(printf '%s\n' "$marketplace_dirs") <(printf '%s\n' "$catalog_dirs"))

while IFS= read -r dir; do
  [[ -n "$dir" ]] || continue
  if [[ ! -f "$REPO_ROOT/$dir/README.md" ]]; then
    log error "$dir: README plugin catalog links to a missing file: $dir/README.md"
    fail=1
  fi
done <<<"$catalog_dirs"

if (( fail != 0 )); then
  log error "verify-plugin-catalog failed"
  exit 1
fi

log ok "verify-plugin-catalog passed ($(grep -c . <<<"$catalog_dirs") plugins in README catalog)"

#!/usr/bin/env bash
# verify.sh — run every deterministic repository check. CI and local development
# both use this entry point, so a check added here runs in both.
#
# Tests are discovered by file-name convention or a package verify script, so
# adding a test needs no edit here or in CI. Installs nothing: CI and contributors
# provide the tools listed in CONTRIBUTING.md.
# shellcheck shell=bash

set -euo pipefail
export SCRIPT_NAME="verify"
# shellcheck source=lib/common.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

for cmd in jq git shellcheck node python3 bun; do
  require_cmd "$cmd"
done

cd "$REPO_ROOT"

failed=()

# check <label> <command...> — run one check and record its failure without stopping
check() {
  local label="$1"
  shift
  log info "running: $label"
  if "$@"; then
    log ok "$label"
  else
    log error "$label failed"
    failed+=("$label")
  fi
}

# globstar is unavailable in the bash 3.2 that macOS ships.
shell_scripts=()
while IFS= read -r f; do
  shell_scripts+=("$f")
done < <(find scripts -name '*.sh' -type f | LC_ALL=C sort)
check "shellcheck scripts/" shellcheck -S warning -x "${shell_scripts[@]}"

check "verify-versions" bash scripts/verify-versions.sh
check "verify-plugin-catalog" bash scripts/verify-plugin-catalog.sh

for t in scripts/tests/*.test.sh; do
  check "$t" bash "$t"
done

for dir in plugins/*/tests; do
  [[ -d "$dir" ]] || continue
  if compgen -G "$dir/*.test.mjs" >/dev/null; then
    check "$dir (node)" node --test "$dir"/*.test.mjs
  fi
  if compgen -G "$dir/test_*.py" >/dev/null; then
    check "$dir (python)" python3 -m unittest discover -s "$dir" -v
  fi
done

for package in plugins/*/skills/*/package.json; do
  [[ -f "$package" ]] || continue
  if jq -e '.scripts.verify | type == "string"' "$package" >/dev/null; then
    check "${package%/package.json} (bun)" bash -c 'cd "$1" && bun run verify' _ "${package%/package.json}"
  fi
done

if (( ${#failed[@]} > 0 )); then
  log error "verify failed: ${failed[*]}"
  exit 1
fi

log ok "verify passed"

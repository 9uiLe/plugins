#!/usr/bin/env bash
# verify-versions-completeness.test.sh — acceptance tests for the
# filesystem <-> marketplace bidirectional completeness checks (Issue #64).
#
# Builds a minimal fixture repository in a temp directory, mutates it per
# scenario, and asserts that scripts/verify-versions.sh passes or fails with
# the expected diagnostic.
set -euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TESTS_DIR/../.." && pwd)"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

failures=0
run=0

# make_fixture <dir> — create a minimal repo with one dual-registered plugin
make_fixture() {
  local fixture="$1"
  rm -rf "$fixture"
  mkdir -p "$fixture"
  cp -R "$REPO_ROOT/scripts" "$fixture/scripts"
  rm -rf "$fixture/scripts/tests"

  mkdir -p "$fixture/.claude-plugin" "$fixture/.agents/plugins"
  cat >"$fixture/.claude-plugin/marketplace.json" <<'JSON'
{
  "metadata": { "version": "1.0.0" },
  "plugins": [
    { "name": "alpha", "source": "./plugins/alpha", "version": "1.0.0" }
  ]
}
JSON
  cat >"$fixture/.agents/plugins/marketplace.json" <<'JSON'
{
  "plugins": [
    { "name": "alpha", "source": { "source": "local", "path": "./plugins/alpha" } }
  ]
}
JSON

  mkdir -p "$fixture/plugins/alpha/.claude-plugin" "$fixture/plugins/alpha/.codex-plugin"
  printf '{ "name": "alpha", "version": "1.0.0" }\n' >"$fixture/plugins/alpha/.claude-plugin/plugin.json"
  printf '{ "name": "alpha", "version": "1.0.0" }\n' >"$fixture/plugins/alpha/.codex-plugin/plugin.json"
}

# expect_pass <label> <fixture>
expect_pass() {
  local label="$1" fixture="$2" out
  run=$((run + 1))
  if out="$(bash "$fixture/scripts/verify-versions.sh" 2>&1)"; then
    echo "ok: $label"
  else
    echo "FAIL: $label — expected pass, got failure:"
    printf '%s\n' "$out" | sed 's/^/    /'
    failures=$((failures + 1))
  fi
}

# expect_fail_with <label> <fixture> <diagnostic-substring>
expect_fail_with() {
  local label="$1" fixture="$2" needle="$3" out
  run=$((run + 1))
  if out="$(bash "$fixture/scripts/verify-versions.sh" 2>&1)"; then
    echo "FAIL: $label — expected failure, but verify-versions passed"
    failures=$((failures + 1))
    return
  fi
  if grep -qF "$needle" <<<"$out"; then
    echo "ok: $label"
  else
    echo "FAIL: $label — failed, but expected diagnostic not found: $needle"
    printf '%s\n' "$out" | sed 's/^/    /'
    failures=$((failures + 1))
  fi
}

fixture="$WORK_DIR/fixture"

# 1. Baseline: a consistent repo passes.
make_fixture "$fixture"
expect_pass "baseline fixture passes" "$fixture"

# 2. Plugin directory exists but is missing from the Claude marketplace.
make_fixture "$fixture"
mkdir -p "$fixture/plugins/beta/.claude-plugin"
printf '{ "name": "beta", "version": "1.0.0" }\n' >"$fixture/plugins/beta/.claude-plugin/plugin.json"
expect_fail_with "unregistered plugin directory fails" "$fixture" \
  "plugins/beta: exists on filesystem but is not registered in .claude-plugin/marketplace.json"

# 3. Codex-capable plugin missing from the Codex marketplace (filesystem origin).
make_fixture "$fixture"
mkdir -p "$fixture/plugins/gamma/.claude-plugin" "$fixture/plugins/gamma/.codex-plugin"
printf '{ "name": "gamma", "version": "1.0.0" }\n' >"$fixture/plugins/gamma/.claude-plugin/plugin.json"
printf '{ "name": "gamma", "version": "1.0.0" }\n' >"$fixture/plugins/gamma/.codex-plugin/plugin.json"
jq '.plugins += [{ "name": "gamma", "source": "./plugins/gamma", "version": "1.0.0" }]' \
  "$fixture/.claude-plugin/marketplace.json" >"$fixture/.claude-plugin/marketplace.json.tmp"
mv "$fixture/.claude-plugin/marketplace.json.tmp" "$fixture/.claude-plugin/marketplace.json"
expect_fail_with "codex-capable plugin missing from Codex marketplace fails" "$fixture" \
  "gamma: missing from .agents/plugins/marketplace.json"

# 4. Directory with no manifest at all (stale remnant).
make_fixture "$fixture"
mkdir -p "$fixture/plugins/stale/skills"
printf 'leftover\n' >"$fixture/plugins/stale/skills/notes.md"
expect_fail_with "manifest-less plugin directory fails" "$fixture" \
  "plugins/stale: no plugin manifest"

# 5. Claude marketplace entry with a dangling source path.
make_fixture "$fixture"
jq '.plugins += [{ "name": "ghost", "source": "./plugins/ghost", "version": "1.0.0" }]' \
  "$fixture/.claude-plugin/marketplace.json" >"$fixture/.claude-plugin/marketplace.json.tmp"
mv "$fixture/.claude-plugin/marketplace.json.tmp" "$fixture/.claude-plugin/marketplace.json"
mkdir -p "$fixture/plugins/ghost/.claude-plugin" "$fixture/plugins/ghost/.codex-plugin"
printf '{ "name": "ghost", "version": "1.0.0" }\n' >"$fixture/plugins/ghost/.claude-plugin/plugin.json"
printf '{ "name": "ghost", "version": "1.0.0" }\n' >"$fixture/plugins/ghost/.codex-plugin/plugin.json"
jq '.plugins += [{ "name": "ghost", "source": { "source": "local", "path": "./plugins/ghost" } }]' \
  "$fixture/.agents/plugins/marketplace.json" >"$fixture/.agents/plugins/marketplace.json.tmp"
mv "$fixture/.agents/plugins/marketplace.json.tmp" "$fixture/.agents/plugins/marketplace.json"
jq '(.plugins[] | select(.name == "ghost") | .source) = "./plugins/missing"' \
  "$fixture/.claude-plugin/marketplace.json" >"$fixture/.claude-plugin/marketplace.json.tmp"
mv "$fixture/.claude-plugin/marketplace.json.tmp" "$fixture/.claude-plugin/marketplace.json"
expect_fail_with "dangling Claude marketplace source path fails" "$fixture" \
  "does not exist (dangling path)"

# 6. Codex marketplace entry with a dangling source path.
make_fixture "$fixture"
jq '(.plugins[] | select(.name == "alpha") | .source.path) = "./plugins/missing"' \
  "$fixture/.agents/plugins/marketplace.json" >"$fixture/.agents/plugins/marketplace.json.tmp"
mv "$fixture/.agents/plugins/marketplace.json.tmp" "$fixture/.agents/plugins/marketplace.json"
expect_fail_with "dangling Codex marketplace source path fails" "$fixture" \
  ".agents/plugins/marketplace.json source.path './plugins/missing' does not exist"

if (( failures > 0 )); then
  echo "verify-versions-completeness: $failures/$run tests failed"
  exit 1
fi
echo "verify-versions-completeness: all $run tests passed"

#!/usr/bin/env bash
# helpers.sh — fixture repositories and assertions shared by scripts/tests/*.test.sh
# shellcheck shell=bash

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TESTS_DIR/../.." && pwd)"

tests_run=0
tests_failed=0

# ---------- fixtures ----------

# make_fixture <dir> — create a minimal repo with one dual-registered plugin (alpha 1.0.0)
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

# edit_json <file> <jq-filter> [jq-args...] — rewrite a JSON file in place
edit_json() {
  local file="$1" filter="$2"
  shift 2
  jq "$@" "$filter" "$file" >"$file.tmp"
  mv "$file.tmp" "$file"
}

# add_plugin <fixture> <name> <version> — add a plugin registered in both marketplaces
add_plugin() {
  local fixture="$1" name="$2" version="$3"
  mkdir -p "$fixture/plugins/$name/.claude-plugin" "$fixture/plugins/$name/.codex-plugin"
  printf '{ "name": "%s", "version": "%s" }\n' "$name" "$version" >"$fixture/plugins/$name/.claude-plugin/plugin.json"
  printf '{ "name": "%s", "version": "%s" }\n' "$name" "$version" >"$fixture/plugins/$name/.codex-plugin/plugin.json"
  edit_json "$fixture/.claude-plugin/marketplace.json" \
    '.plugins += [{ "name": $n, "source": ("./plugins/" + $n), "version": $v }]' \
    --arg n "$name" --arg v "$version"
  edit_json "$fixture/.agents/plugins/marketplace.json" \
    '.plugins += [{ "name": $n, "source": { "source": "local", "path": ("./plugins/" + $n) } }]' \
    --arg n "$name"
}

# ---------- assertions ----------

pass() {
  tests_run=$((tests_run + 1))
  echo "ok: $1"
}

# fail <label> <reason> [detail]
fail() {
  tests_run=$((tests_run + 1))
  tests_failed=$((tests_failed + 1))
  echo "FAIL: $1 — $2"
  if [[ -n "${3-}" ]]; then
    printf '%s\n' "$3" | sed 's/^/    /'
  fi
}

# expect_success <label> <command...>
expect_success() {
  local label="$1" out
  shift
  if out="$("$@" 2>&1)"; then
    pass "$label"
  else
    fail "$label" "expected success, got failure:" "$out"
  fi
}

# expect_failure_with <label> <diagnostic-substring> <command...>
expect_failure_with() {
  local label="$1" needle="$2" out
  shift 2
  if out="$("$@" 2>&1)"; then
    fail "$label" "expected failure, but the command succeeded" "$out"
  elif [[ "$out" == *"$needle"* ]]; then
    pass "$label"
  else
    fail "$label" "failed, but expected diagnostic not found: $needle" "$out"
  fi
}

# assert_eq <label> <expected> <actual>
assert_eq() {
  if [[ "$2" == "$3" ]]; then
    pass "$1"
  else
    fail "$1" "expected [$2], got [$3]"
  fi
}

# assert_contains <label> <haystack> <needle> — needle may span multiple lines
assert_contains() {
  if [[ "$2" == *"$3"* ]]; then
    pass "$1"
  else
    fail "$1" "expected to contain:" "$3"$'\n'"--- actual ---"$'\n'"$2"
  fi
}

# assert_not_contains <label> <haystack> <needle>
assert_not_contains() {
  if [[ "$2" != *"$3"* ]]; then
    pass "$1"
  else
    fail "$1" "expected not to contain:" "$3"
  fi
}

# finish <suite-name> — print the summary and exit non-zero on any failure
finish() {
  if (( tests_failed > 0 )); then
    echo "$1: $tests_failed/$tests_run tests failed"
    exit 1
  fi
  echo "$1: all $tests_run tests passed"
}

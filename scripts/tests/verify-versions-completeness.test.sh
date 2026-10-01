#!/usr/bin/env bash
# verify-versions-completeness.test.sh — acceptance tests for the
# filesystem <-> marketplace bidirectional completeness checks (Issue #64).
#
# Builds a minimal fixture repository in a temp directory, mutates it per
# scenario, and asserts that scripts/verify-versions.sh passes or fails with
# the expected diagnostic.
set -euo pipefail

# shellcheck source=helpers.sh
. "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

verify() { bash "$1/scripts/verify-versions.sh"; }

fixture="$WORK_DIR/fixture"

# 1. Baseline: a consistent repo passes.
make_fixture "$fixture"
expect_success "baseline fixture passes" verify "$fixture"

# 2. Plugin directory exists but is missing from the Claude marketplace.
make_fixture "$fixture"
mkdir -p "$fixture/plugins/beta/.claude-plugin"
printf '{ "name": "beta", "version": "1.0.0" }\n' >"$fixture/plugins/beta/.claude-plugin/plugin.json"
expect_failure_with "unregistered plugin directory fails" \
  "plugins/beta: exists on filesystem but is not registered in .claude-plugin/marketplace.json" verify "$fixture"

# 3. Codex-capable plugin missing from the Codex marketplace (filesystem origin).
make_fixture "$fixture"
mkdir -p "$fixture/plugins/gamma/.claude-plugin" "$fixture/plugins/gamma/.codex-plugin"
printf '{ "name": "gamma", "version": "1.0.0" }\n' >"$fixture/plugins/gamma/.claude-plugin/plugin.json"
printf '{ "name": "gamma", "version": "1.0.0" }\n' >"$fixture/plugins/gamma/.codex-plugin/plugin.json"
jq '.plugins += [{ "name": "gamma", "source": "./plugins/gamma", "version": "1.0.0" }]' \
  "$fixture/.claude-plugin/marketplace.json" >"$fixture/.claude-plugin/marketplace.json.tmp"
mv "$fixture/.claude-plugin/marketplace.json.tmp" "$fixture/.claude-plugin/marketplace.json"
expect_failure_with "codex-capable plugin missing from Codex marketplace fails" \
  "gamma: missing from .agents/plugins/marketplace.json" verify "$fixture"

# 4. Directory with no manifest at all (stale remnant).
make_fixture "$fixture"
mkdir -p "$fixture/plugins/stale/skills"
printf 'leftover\n' >"$fixture/plugins/stale/skills/notes.md"
expect_failure_with "manifest-less plugin directory fails" \
  "plugins/stale: no plugin manifest" verify "$fixture"

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
expect_failure_with "dangling Claude marketplace source path fails" \
  "does not exist (dangling path)" verify "$fixture"

# 6. Codex marketplace entry with a dangling source path.
make_fixture "$fixture"
jq '(.plugins[] | select(.name == "alpha") | .source.path) = "./plugins/missing"' \
  "$fixture/.agents/plugins/marketplace.json" >"$fixture/.agents/plugins/marketplace.json.tmp"
mv "$fixture/.agents/plugins/marketplace.json.tmp" "$fixture/.agents/plugins/marketplace.json"
expect_failure_with "dangling Codex marketplace source path fails" \
  ".agents/plugins/marketplace.json source.path './plugins/missing' does not exist" verify "$fixture"

finish verify-versions-completeness

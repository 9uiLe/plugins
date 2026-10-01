#!/usr/bin/env bash
# verify-versions.test.sh — acceptance tests for the version consistency checks
# of scripts/verify-versions.sh: Claude / Codex / marketplace plugin versions
# agree, and metadata.version >= max(plugin versions).
#
# Filesystem <-> marketplace completeness is owned by
# verify-versions-completeness.test.sh.
set -euo pipefail

# shellcheck source=helpers.sh
. "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

verify() { bash "$1/scripts/verify-versions.sh"; }

fixture="$WORK_DIR/fixture"

# metadata.version may equal the highest plugin version; lower plugins do not matter.
make_fixture "$fixture"
add_plugin "$fixture" bravo 0.3.0
expect_success "metadata.version equal to the max plugin version passes" verify "$fixture"

make_fixture "$fixture"
edit_json "$fixture/.claude-plugin/marketplace.json" '(.plugins[] | select(.name == "alpha") | .version) = "1.0.1"'
expect_failure_with "Claude plugin version differing from marketplace fails" \
  "alpha: version mismatch (.claude-plugin/plugin.json=1.0.0, marketplace.json=1.0.1)" verify "$fixture"

make_fixture "$fixture"
edit_json "$fixture/plugins/alpha/.codex-plugin/plugin.json" '.version = "1.0.1"'
expect_failure_with "Codex plugin version differing from Claude fails" \
  "alpha: version mismatch (.codex-plugin/plugin.json=1.0.1, .claude-plugin/plugin.json=1.0.0)" verify "$fixture"

make_fixture "$fixture"
add_plugin "$fixture" bravo 1.2.0
expect_failure_with "metadata.version below the max plugin version fails" \
  "metadata.version (1.0.0) is older than max plugin version (1.2.0)" verify "$fixture"

finish verify-versions

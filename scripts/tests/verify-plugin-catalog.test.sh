#!/usr/bin/env bash
# verify-plugin-catalog.test.sh — acceptance tests for scripts/verify-plugin-catalog.sh:
# the root README plugin catalog and .claude-plugin/marketplace.json list the same plugins.
set -euo pipefail

# shellcheck source=helpers.sh
. "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

verify() { bash "$1/scripts/verify-plugin-catalog.sh"; }

# write_catalog <fixture> <plugin-dir...> — README with one catalog row per plugin,
# plus a non-catalog link to a plugin README that must not count as a catalog row.
write_catalog() {
  local fixture="$1" name
  shift
  {
    printf '# fixture\n\n| プラグイン | 用途 |\n| --- | --- |\n'
    for name in "$@"; do
      printf '| [%s](./plugins/%s/README.md) | %s の用途 |\n' "$name" "$name" "$name"
    done
    printf '\n詳細は [alpha の README](./plugins/alpha/README.md) を参照。\n'
  } >"$fixture/README.md"
}

# add_plugin_readme <fixture> <plugin-dir...>
add_plugin_readme() {
  local fixture="$1" name
  shift
  for name in "$@"; do
    printf '# %s\n' "$name" >"$fixture/plugins/$name/README.md"
  done
}

fixture="$WORK_DIR/fixture"

make_fixture "$fixture"
add_plugin "$fixture" bravo 0.3.0
add_plugin_readme "$fixture" alpha bravo
write_catalog "$fixture" alpha bravo
expect_success "catalog listing every marketplace plugin passes" verify "$fixture"

make_fixture "$fixture"
add_plugin "$fixture" bravo 0.3.0
add_plugin_readme "$fixture" alpha bravo
write_catalog "$fixture" alpha
expect_failure_with "marketplace plugin missing from the catalog fails" \
  "plugins/bravo: distributed by .claude-plugin/marketplace.json but missing from the README plugin catalog" \
  verify "$fixture"

make_fixture "$fixture"
mkdir -p "$fixture/plugins/charlie"
add_plugin_readme "$fixture" alpha charlie
write_catalog "$fixture" alpha charlie
expect_failure_with "catalog plugin not in the marketplace fails" \
  "plugins/charlie: listed in the README plugin catalog but not distributed by .claude-plugin/marketplace.json" \
  verify "$fixture"

make_fixture "$fixture"
write_catalog "$fixture" alpha
expect_failure_with "catalog link to a missing plugin README fails" \
  "plugins/alpha: README plugin catalog links to a missing file: plugins/alpha/README.md" \
  verify "$fixture"

finish verify-plugin-catalog

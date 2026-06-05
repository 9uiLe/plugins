#!/usr/bin/env bash
# verify-versions.sh — assert plugin.json and marketplace.json versions agree
# Used both as a release post-condition and as a CI gate on every PR.
# shellcheck shell=bash source=./lib/version.sh

set -euo pipefail
export SCRIPT_NAME="verify-versions"
# shellcheck source=lib/version.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/version.sh"

require_cmd jq

fail=0
checked=0

while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  checked=$((checked + 1))
  plugin_ver="$(read_plugin_version "$name")"
  marketplace_ver="$(read_marketplace_plugin_version "$name")"

  if ! is_semver "$plugin_ver"; then
    log error "$name: plugin.json version is not valid semver: '$plugin_ver'"
    fail=1
    continue
  fi
  if ! is_semver "$marketplace_ver"; then
    log error "$name: marketplace.json version is not valid semver: '$marketplace_ver'"
    fail=1
    continue
  fi
  if [[ "$plugin_ver" != "$marketplace_ver" ]]; then
    log error "$name: version mismatch (plugin.json=$plugin_ver, marketplace.json=$marketplace_ver)"
    fail=1
  else
    log ok "$name: $plugin_ver"
  fi
done < <(list_plugins)

# metadata.version must be >= max(plugin versions); it represents marketplace release line.
meta_ver="$(read_marketplace_metadata_version)"
if ! is_semver "$meta_ver"; then
  log error "marketplace.json metadata.version is not valid semver: '$meta_ver'"
  fail=1
else
  max_ver="0.0.0"
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    v="$(read_plugin_version "$name")"
    if semver_gt "$v" "$max_ver"; then
      max_ver="$v"
    fi
  done < <(list_plugins)

  if semver_gt "$max_ver" "$meta_ver"; then
    log error "metadata.version ($meta_ver) is older than max plugin version ($max_ver)"
    fail=1
  else
    log ok "metadata.version: $meta_ver (>= max plugin $max_ver)"
  fi
fi

if (( fail != 0 )); then
  log error "verify-versions failed ($checked plugins checked)"
  exit 1
fi

log ok "verify-versions passed ($checked plugins checked)"

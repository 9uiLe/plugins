#!/usr/bin/env bash
# version.sh — read/write version fields in plugin.json and marketplace.json
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# list_plugins — print plugin names declared in marketplace.json
list_plugins() {
  jq -r '.plugins[].name' "$MARKETPLACE_JSON"
}

# plugin_path <name> — print absolute path to a plugin directory
plugin_path() {
  local name="$1"
  local rel
  rel="$(jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .source' "$MARKETPLACE_JSON")"
  [[ -n "$rel" && "$rel" != "null" ]] || die "plugin not found in marketplace.json: $name"
  printf '%s/%s' "$REPO_ROOT" "${rel#./}"
}

# plugin_json <name> — print absolute path to plugin.json
plugin_json() {
  local name="$1"
  printf '%s/.claude-plugin/plugin.json' "$(plugin_path "$name")"
}

# read_plugin_version <name>
read_plugin_version() {
  local name="$1"
  jq -r '.version' "$(plugin_json "$name")"
}

# read_marketplace_plugin_version <name>
read_marketplace_plugin_version() {
  local name="$1"
  jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .version' "$MARKETPLACE_JSON"
}

# read_marketplace_metadata_version
read_marketplace_metadata_version() {
  jq -r '.metadata.version' "$MARKETPLACE_JSON"
}

# write_plugin_version <name> <new-version>
write_plugin_version() {
  local name="$1" new="$2"
  is_semver "$new" || die "invalid semver: $new"
  local file
  file="$(plugin_json "$name")"
  local tmp
  tmp="$(mktemp)"
  jq --arg v "$new" '.version = $v' "$file" >"$tmp"
  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would update $file:"
    diff -u "$file" "$tmp" || true
    rm -f "$tmp"
  else
    mv "$tmp" "$file"
    log ok "updated $file -> $new"
  fi
}

# write_marketplace_plugin_version <name> <new-version>
write_marketplace_plugin_version() {
  local name="$1" new="$2"
  is_semver "$new" || die "invalid semver: $new"
  local tmp
  tmp="$(mktemp)"
  jq --arg n "$name" --arg v "$new" \
    '(.plugins[] | select(.name == $n) | .version) = $v' \
    "$MARKETPLACE_JSON" >"$tmp"
  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would update marketplace.json [$name -> $new]:"
    diff -u "$MARKETPLACE_JSON" "$tmp" || true
    rm -f "$tmp"
  else
    mv "$tmp" "$MARKETPLACE_JSON"
    log ok "marketplace.json plugins[$name].version -> $new"
  fi
}

# write_marketplace_metadata_version <new-version>
write_marketplace_metadata_version() {
  local new="$1"
  is_semver "$new" || die "invalid semver: $new"
  local tmp
  tmp="$(mktemp)"
  jq --arg v "$new" '.metadata.version = $v' "$MARKETPLACE_JSON" >"$tmp"
  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would update marketplace.json metadata.version -> $new"
    diff -u "$MARKETPLACE_JSON" "$tmp" || true
    rm -f "$tmp"
  else
    mv "$tmp" "$MARKETPLACE_JSON"
    log ok "marketplace.json metadata.version -> $new"
  fi
}

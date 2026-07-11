#!/usr/bin/env bash
# version.sh — read/write version fields in Claude/Codex plugin manifests and marketplace.json
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

MARKETPLACE_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

# Plugins that are intentionally Claude Code-only: they ship no .codex-plugin
# manifest and are not registered in the Codex marketplace. Every other plugin
# must be dual-registered; verify-versions enforces that to catch accidental
# omissions. To make a plugin Claude-only, add its name here.
CLAUDE_ONLY_PLUGINS=()

# is_claude_only_plugin <name> — return 0 if the plugin is Claude Code-only
is_claude_only_plugin() {
  local name="$1" p
  for p in "${CLAUDE_ONLY_PLUGINS[@]-}"; do
    [[ "$p" == "$name" ]] && return 0
  done
  return 1
}

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

# plugin_json <name> — print absolute path to the Claude plugin.json
plugin_json() {
  local name="$1"
  printf '%s/.claude-plugin/plugin.json' "$(plugin_path "$name")"
}

# codex_plugin_json <name> — print absolute path to the Codex plugin.json
codex_plugin_json() {
  local name="$1"
  printf '%s/.codex-plugin/plugin.json' "$(plugin_path "$name")"
}

# read_plugin_version <name>
read_plugin_version() {
  local name="$1"
  jq -r '.version' "$(plugin_json "$name")"
}

# read_codex_plugin_version <name>
read_codex_plugin_version() {
  local name="$1"
  jq -r '.version' "$(codex_plugin_json "$name")"
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

write_json_version() {
  local file="$1" new="$2" label="$3"
  local tmp
  tmp="$(mktemp)"
  jq --arg v "$new" '.version = $v' "$file" >"$tmp"
  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would update $label:"
    diff -u "$file" "$tmp" || true
    rm -f "$tmp"
  else
    mv "$tmp" "$file"
    log ok "updated $label -> $new"
  fi
}

# write_plugin_version <name> <new-version>
write_plugin_version() {
  local name="$1" new="$2"
  is_semver "$new" || die "invalid semver: $new"
  write_json_version "$(plugin_json "$name")" "$new" "$(plugin_json "$name")"
  # Claude-only plugins have no Codex manifest to update.
  if ! is_claude_only_plugin "$name"; then
    write_json_version "$(codex_plugin_json "$name")" "$new" "$(codex_plugin_json "$name")"
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

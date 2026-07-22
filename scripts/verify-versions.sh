#!/usr/bin/env bash
# verify-versions.sh — assert Claude/Codex plugin.json and marketplace.json versions agree
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

  # Guard against dangling marketplace source paths: fail with a diagnostic
  # instead of letting jq abort the whole script on a missing manifest.
  claude_manifest="$(plugin_json "$name")"
  if [[ ! -f "$claude_manifest" ]]; then
    log error "$name: Claude plugin manifest not found: ${claude_manifest#"$REPO_ROOT"/} (dangling marketplace source?)"
    fail=1
    continue
  fi

  plugin_ver="$(read_plugin_version "$name")"
  marketplace_ver="$(read_marketplace_plugin_version "$name")"

  if ! is_semver "$plugin_ver"; then
    log error "$name: .claude-plugin/plugin.json version is not valid semver: '$plugin_ver'"
    fail=1
    continue
  fi
  if ! is_semver "$marketplace_ver"; then
    log error "$name: marketplace.json version is not valid semver: '$marketplace_ver'"
    fail=1
    continue
  fi
  if [[ "$plugin_ver" != "$marketplace_ver" ]]; then
    log error "$name: version mismatch (.claude-plugin/plugin.json=$plugin_ver, marketplace.json=$marketplace_ver)"
    fail=1
    continue
  fi

  # Claude-only plugins ship no Codex manifest; the Claude/marketplace agreement
  # checked above is all that applies.
  if is_claude_only_plugin "$name"; then
    log ok "$name: $plugin_ver (Claude-only)"
    continue
  fi

  codex_plugin_ver="$(read_codex_plugin_version "$name")"
  if ! is_semver "$codex_plugin_ver"; then
    log error "$name: .codex-plugin/plugin.json version is not valid semver: '$codex_plugin_ver'"
    fail=1
  elif [[ "$codex_plugin_ver" != "$plugin_ver" ]]; then
    log error "$name: version mismatch (.codex-plugin/plugin.json=$codex_plugin_ver, .claude-plugin/plugin.json=$plugin_ver)"
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
    # Missing manifests (dangling source paths) are reported separately above.
    [[ -f "$(plugin_json "$name")" ]] || continue
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

AGENTS_MARKETPLACE_JSON="$REPO_ROOT/.agents/plugins/marketplace.json"

# ---------- filesystem -> marketplace completeness (Issue #64) ----------
# marketplace.json 起点の検査だけでは「plugins/ に実在するのに未登録のプラグイン」
# を検出できない。ここでは filesystem を起点に、各プラグインディレクトリが
# marketplace に登録されていることを検査する。
PLUGINS_DIR="$REPO_ROOT/plugins"
for dir in "$PLUGINS_DIR"/*/; do
  [[ -d "$dir" ]] || continue
  dirname="$(basename "$dir")"
  has_claude_manifest=0
  has_codex_manifest=0
  [[ -f "$dir/.claude-plugin/plugin.json" ]] && has_claude_manifest=1
  [[ -f "$dir/.codex-plugin/plugin.json" ]] && has_codex_manifest=1

  # Directories with no manifest at all are stale remnants (or half-added
  # plugins); they can silently survive because nothing else looks at them.
  if (( ! has_claude_manifest && ! has_codex_manifest )); then
    log error "plugins/$dirname: no plugin manifest (.claude-plugin/plugin.json or .codex-plugin/plugin.json); remove the directory or add a manifest"
    fail=1
    continue
  fi

  # Every real plugin directory must be registered in the Claude marketplace,
  # or it exists as an uninstallable plugin.
  if jq -e --arg n "$dirname" '.plugins[] | select(.name == $n)' "$MARKETPLACE_JSON" >/dev/null; then
    log ok "plugins/$dirname: registered in .claude-plugin/marketplace.json"
  else
    log error "plugins/$dirname: exists on filesystem but is not registered in .claude-plugin/marketplace.json (not installable)"
    fail=1
  fi

  # A plugin that ships a Codex manifest must be installable from Codex too.
  if (( has_codex_manifest )); then
    if is_claude_only_plugin "$dirname"; then
      log error "plugins/$dirname: listed in CLAUDE_ONLY_PLUGINS but ships .codex-plugin/plugin.json (contradictory; remove one)"
      fail=1
    elif [[ -f "$AGENTS_MARKETPLACE_JSON" ]] && ! jq -e --arg n "$dirname" '.plugins[] | select(.name == $n)' "$AGENTS_MARKETPLACE_JSON" >/dev/null; then
      log error "plugins/$dirname: ships .codex-plugin/plugin.json but is not registered in .agents/plugins/marketplace.json"
      fail=1
    fi
  fi
done

# ---------- marketplace -> filesystem completeness (Issue #64) ----------
# Each marketplace entry's source path must point at an existing directory;
# otherwise the entry advertises an uninstallable (dangling) plugin.
while IFS=$'\t' read -r name src; do
  [[ -n "$name" ]] || continue
  if [[ -z "$src" || "$src" == "null" ]]; then
    log error "$name: .claude-plugin/marketplace.json entry has no source path"
    fail=1
  elif [[ ! -d "$REPO_ROOT/${src#./}" ]]; then
    log error "$name: .claude-plugin/marketplace.json source '$src' does not exist (dangling path)"
    fail=1
  else
    log ok "$name: marketplace source path exists ($src)"
  fi
done < <(jq -r '.plugins[] | [.name, (.source // "")] | @tsv' "$MARKETPLACE_JSON")

if [[ -f "$AGENTS_MARKETPLACE_JSON" ]]; then
  while IFS=$'\t' read -r name src; do
    [[ -n "$name" ]] || continue
    if [[ -z "$src" || "$src" == "null" ]]; then
      log error "$name: .agents/plugins/marketplace.json entry has no source.path"
      fail=1
    elif [[ ! -d "$REPO_ROOT/${src#./}" ]]; then
      log error "$name: .agents/plugins/marketplace.json source.path '$src' does not exist (dangling path)"
      fail=1
    else
      log ok "$name: Codex marketplace source path exists ($src)"
    fi
  done < <(jq -r '.plugins[] | [.name, (.source.path // "")] | @tsv' "$AGENTS_MARKETPLACE_JSON")
fi

# Every plugin in the Claude marketplace must also be listed in the Codex
# marketplace manifest, or it cannot be installed from Codex. Generalized from
# agent-ops being registered only in .claude-plugin/marketplace.json.
if [[ ! -f "$AGENTS_MARKETPLACE_JSON" ]]; then
  log error "Codex marketplace manifest not found: $AGENTS_MARKETPLACE_JSON"
  fail=1
else
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    if is_claude_only_plugin "$name"; then
      if jq -e --arg n "$name" '.plugins[] | select(.name == $n)' "$AGENTS_MARKETPLACE_JSON" >/dev/null; then
        log error "$name: is Claude-only but IS listed in .agents/plugins/marketplace.json (would advertise a non-functional Codex install)"
        fail=1
      else
        log ok "$name: Claude-only (correctly absent from Codex marketplace)"
      fi
      continue
    fi
    if jq -e --arg n "$name" '.plugins[] | select(.name == $n)' "$AGENTS_MARKETPLACE_JSON" >/dev/null; then
      log ok "$name: listed in .agents/plugins/marketplace.json"
    else
      log error "$name: missing from .agents/plugins/marketplace.json (not installable from Codex)"
      fail=1
    fi
  done < <(list_plugins)
fi

if (( fail != 0 )); then
  log error "verify-versions failed ($checked plugins checked)"
  exit 1
fi

log ok "verify-versions passed ($checked plugins checked)"

#!/usr/bin/env bash
# release-prepare.sh — prepare a release branch and open a PR.
#
# Usage:
#   scripts/release-prepare.sh [--plugin <name>:<patch|minor|major|X.Y.Z>]...
#                              [--release-bump patch|minor|major | --release-version X.Y.Z]
#                              [--dry-run] [--yes] [--no-pr]
#
# Two version axes:
#   - plugin version  (Claude/Codex plugin.json, marketplace.json plugins[].version)
#   - release version (marketplace metadata.version, branch, CHANGELOG, tag)
# A release changes zero or more plugin versions (one --plugin per plugin) and
# always advances the release version; without a selector it is a patch bump.
# CHANGELOG/branch/tag use the release version.
#
# Always run with --dry-run first.

set -euo pipefail
export SCRIPT_NAME="release-prepare"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/version.sh
. "$SCRIPT_DIR/lib/version.sh"
# shellcheck source=lib/changelog.sh
. "$SCRIPT_DIR/lib/changelog.sh"
# shellcheck source=lib/release-notes.sh
. "$SCRIPT_DIR/lib/release-notes.sh"

PLUGIN_CHANGE_ARGS=()      # raw --plugin values: <name>:<patch|minor|major|X.Y.Z>
RELEASE_SELECTOR="default" # default | bump | version
RELEASE_SELECTOR_VALUE=""  # bump kind or X.Y.Z; empty for default
NO_PR=0

usage() {
  sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# select_release <bump|version> <value>
select_release() {
  [[ "$RELEASE_SELECTOR" == "default" ]] || \
    die "specify at most one release selector (--release-bump or --release-version)"
  RELEASE_SELECTOR="$1"
  RELEASE_SELECTOR_VALUE="$2"
}

is_bump_kind() {
  [[ "$1" == "patch" || "$1" == "minor" || "$1" == "major" ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plugin)            PLUGIN_CHANGE_ARGS+=("$2"); shift 2 ;;
    --release-bump)      select_release bump "$2"; shift 2 ;;
    --release-version)   select_release version "$2"; shift 2 ;;
    --dry-run)           export DRY_RUN=1; shift ;;
    --yes)               export ASSUME_YES=1; shift ;;
    --no-pr)             NO_PR=1; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)                   die "unknown argument: $1" ;;
  esac
done

require_cmd jq
require_cmd git
require_cmd awk
require_cmd sed
[[ "$NO_PR" == "1" ]] || require_cmd forge
[[ "$NO_PR" == "1" ]] || require_cmd gh

# ---------- resolve plugin changes ----------

# Parallel arrays, one entry per changed plugin.
CHANGED_PLUGINS=()
CURRENT_VERSIONS=()
TARGET_VERSIONS=()

known_plugins="$(list_plugins)"
for change in ${PLUGIN_CHANGE_ARGS[@]+"${PLUGIN_CHANGE_ARGS[@]}"}; do
  [[ "$change" == *:* ]] || \
    die "invalid --plugin '$change' (expected <name>:<patch|minor|major|X.Y.Z>)"
  name="${change%%:*}"
  spec="${change#*:}"
  grep -qxF -- "$name" <<<"$known_plugins" || die "unknown plugin: $name"
  for seen in ${CHANGED_PLUGINS[@]+"${CHANGED_PLUGINS[@]}"}; do
    if [[ "$seen" == "$name" ]]; then
      die "plugin $name is specified more than once"
    fi
  done

  current="$(read_plugin_version "$name")"
  if is_bump_kind "$spec"; then
    target="$(bump_semver "$current" "$spec")"
  elif is_semver "$spec"; then
    target="$spec"
  else
    die "invalid --plugin '$change': '$spec' is neither patch|minor|major nor X.Y.Z"
  fi
  semver_gt "$target" "$current" || \
    die "plugin $name: target $target not greater than current $current"

  CHANGED_PLUGINS+=("$name")
  CURRENT_VERSIONS+=("$current")
  TARGET_VERSIONS+=("$target")
done

# resulting_plugin_version <name> — the plugin's version after this release
resulting_plugin_version() {
  local name="$1" i
  for ((i = 0; i < ${#CHANGED_PLUGINS[@]}; i++)); do
    if [[ "${CHANGED_PLUGINS[i]}" == "$name" ]]; then
      printf '%s\n' "${TARGET_VERSIONS[i]}"
      return
    fi
  done
  read_plugin_version "$name"
}

# ---------- resolve release version ----------

current_meta="$(read_marketplace_metadata_version)"
case "$RELEASE_SELECTOR" in
  default)
    RELEASE_VERSION="$(bump_semver "$current_meta" patch)" ;;
  bump)
    is_bump_kind "$RELEASE_SELECTOR_VALUE" || \
      die "invalid --release-bump: $RELEASE_SELECTOR_VALUE (expected patch|minor|major)"
    RELEASE_VERSION="$(bump_semver "$current_meta" "$RELEASE_SELECTOR_VALUE")" ;;
  version)
    RELEASE_VERSION="$RELEASE_SELECTOR_VALUE" ;;
esac
is_semver "$RELEASE_VERSION" || die "invalid target release version: $RELEASE_VERSION"
semver_gt "$RELEASE_VERSION" "$current_meta" || \
  die "release version $RELEASE_VERSION not greater than current metadata.version $current_meta"

# Invariant for verify-versions: metadata.version >= max(plugin versions after this release)
max_plugin="0.0.0"
max_plugin_name=""
while IFS= read -r name; do
  v="$(resulting_plugin_version "$name")"
  if semver_gt "$v" "$max_plugin"; then
    max_plugin="$v"
    max_plugin_name="$name"
  fi
done <<<"$known_plugins"
if semver_gt "$max_plugin" "$RELEASE_VERSION"; then
  die "plugin $max_plugin_name version $max_plugin is greater than release version $RELEASE_VERSION; pass --release-version $max_plugin (or higher)"
fi

# Release data: read from CHANGELOG once, before any write, and handed to both
# the CHANGELOG promotion and the release notes.
DATE="$(date +%Y-%m-%d)"
UNRELEASED_BODY="$(unreleased_body)"
PREVIOUS_RELEASE="$(latest_release_version)"
semver_gt "$RELEASE_VERSION" "$PREVIOUS_RELEASE" || \
  die "release version $RELEASE_VERSION is not greater than previous CHANGELOG release $PREVIOUS_RELEASE"

RELEASE_NOTES="$(release_notes_path "$RELEASE_VERSION")"
[[ ! -e "$RELEASE_NOTES" ]] || die "release notes already exist: ${RELEASE_NOTES#"$REPO_ROOT"/}"

BRANCH="release/v${RELEASE_VERSION}"
log info "release version: v${RELEASE_VERSION} (was v${current_meta})"
if (( ${#CHANGED_PLUGINS[@]} == 0 )); then
  log info "plugins: no version changes"
fi
for ((i = 0; i < ${#CHANGED_PLUGINS[@]}; i++)); do
  log info "plugin ${CHANGED_PLUGINS[i]}: v${TARGET_VERSIONS[i]} (was v${CURRENT_VERSIONS[i]})"
done
log info "date: $DATE, branch: $BRANCH"

pr_summary="- リポジトリリリース版を v${current_meta} → v${RELEASE_VERSION} に bump"
for ((i = 0; i < ${#CHANGED_PLUGINS[@]}; i++)); do
  pr_summary+=$'\n'"- プラグイン \`${CHANGED_PLUGINS[i]}\` を v${CURRENT_VERSIONS[i]} → v${TARGET_VERSIONS[i]} に bump"
done
pr_body="$(cat <<EOF
## Summary

${pr_summary}
- \`CHANGELOG.md\` の [Unreleased] を [${RELEASE_VERSION}] - ${DATE} に繰り上げ
- \`releases/v${RELEASE_VERSION}.md\` 雛形を生成（マージ前にハイライト本文を加筆してください）

## Release notes

詳細は \`releases/v${RELEASE_VERSION}.md\` を参照。

## Test plan

- [ ] CI green (\`verify-versions\` を含む)
- [ ] \`/plugin marketplace add\` で v${RELEASE_VERSION} として認識されること
- [ ] 対象 Skill を 1 回実行して回帰がないこと
EOF
)"

# ---------- preflight ----------

if [[ "$DRY_RUN" != "1" ]]; then
  require_clean_worktree
  require_branch master
  log info "fetching origin..."
  git fetch origin master --quiet
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse origin/master)"
  [[ "$local_sha" == "$remote_sha" ]] || die "local master is not in sync with origin/master"
  ! git rev-parse "refs/tags/v${RELEASE_VERSION}" >/dev/null 2>&1 || die "tag v${RELEASE_VERSION} already exists"
  ! git show-ref --verify --quiet "refs/heads/${BRANCH}" || die "branch ${BRANCH} already exists locally"
fi

# ---------- create branch ----------

if [[ "$DRY_RUN" == "1" ]]; then
  log info "[dry-run] would create branch ${BRANCH} from master"
else
  git checkout -b "$BRANCH" master >/dev/null
  install_rollback_trap "$BRANCH"
  log ok "created branch $BRANCH"
fi

# ---------- edit files ----------

add_files=(
  ".claude-plugin/marketplace.json"
  "CHANGELOG.md"
  "$RELEASE_NOTES"
)
for ((i = 0; i < ${#CHANGED_PLUGINS[@]}; i++)); do
  write_plugin_version "${CHANGED_PLUGINS[i]}" "${TARGET_VERSIONS[i]}"
  write_marketplace_plugin_version "${CHANGED_PLUGINS[i]}" "${TARGET_VERSIONS[i]}"
  add_files+=("$(plugin_json "${CHANGED_PLUGINS[i]}")")
  # Claude-only plugins have no Codex manifest to stage.
  if ! is_claude_only_plugin "${CHANGED_PLUGINS[i]}"; then
    add_files+=("$(codex_plugin_json "${CHANGED_PLUGINS[i]}")")
  fi
done
write_marketplace_metadata_version "$RELEASE_VERSION"

promote_unreleased "$RELEASE_VERSION" "$DATE" "$PREVIOUS_RELEASE" "$UNRELEASED_BODY"
generate_release_notes "$RELEASE_VERSION" "$DATE" "$PREVIOUS_RELEASE" "$UNRELEASED_BODY"

# ---------- post-condition ----------

log info "running verify-versions.sh (post-condition)..."
if [[ "$DRY_RUN" == "1" ]]; then
  log info "[dry-run] skipping verify (files not actually modified)"
else
  "$SCRIPT_DIR/verify-versions.sh"
fi

# ---------- confirm & commit ----------

if [[ "$DRY_RUN" == "1" ]]; then
  log info "[dry-run] would stage: ${add_files[*]#"$REPO_ROOT"/}"
  log info "[dry-run] PR body:"
  printf '%s\n' "$pr_body" >&2
  log ok "dry-run complete; no changes written, no branch created"
  exit 0
fi

confirm_typed "v${RELEASE_VERSION}" "About to commit & push branch ${BRANCH}."

git add "${add_files[@]}"

git commit -m "chore(release): v${RELEASE_VERSION}" >/dev/null
log ok "committed: chore(release): v${RELEASE_VERSION}"

git push -u origin "$BRANCH" >/dev/null
log ok "pushed: $BRANCH"

clear_rollback_trap

# ---------- open PR ----------

if [[ "$NO_PR" == "1" ]]; then
  log info "skipping PR creation (--no-pr)"
  exit 0
fi

confirm "Open PR for ${BRANCH} -> master?"

forge gh pr-create --base master \
  --title "chore(release): v${RELEASE_VERSION}" \
  --body "$pr_body"
log ok "PR opened"

#!/usr/bin/env bash
# release-prepare.sh — prepare a release branch and open a PR.
#
# Usage:
#   scripts/release-prepare.sh --plugin <name> (--bump patch|minor|major | --version X.Y.Z)
#                              [--release-bump patch|minor|major] [--release-version X.Y.Z]
#                              [--dry-run] [--yes] [--no-pr]
#
# Two version axes:
#   - plugin version  (plugin.json, marketplace.json plugins[].version)
#   - release version (marketplace metadata.version, branch, CHANGELOG, tag)
# --release-bump defaults to patch. CHANGELOG/branch/tag use the release version.
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

PLUGIN=""
BUMP=""
VERSION=""
RELEASE_BUMP="patch"
RELEASE_VERSION=""
NO_PR=0

usage() {
  sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plugin)            PLUGIN="$2"; shift 2 ;;
    --bump)              BUMP="$2"; shift 2 ;;
    --version)           VERSION="$2"; shift 2 ;;
    --release-bump)      RELEASE_BUMP="$2"; shift 2 ;;
    --release-version)   RELEASE_VERSION="$2"; shift 2 ;;
    --dry-run)           export DRY_RUN=1; shift ;;
    --yes)               export ASSUME_YES=1; shift ;;
    --no-pr)             NO_PR=1; shift ;;
    -h|--help)           usage; exit 0 ;;
    *)                   die "unknown argument: $1" ;;
  esac
done

# ---------- validate ----------

[[ -n "$PLUGIN" ]] || die "missing --plugin"
[[ -n "$BUMP" || -n "$VERSION" ]] || die "missing --bump or --version"
[[ -n "$BUMP" && -n "$VERSION" ]] && die "specify only one of --bump or --version"
[[ -n "$RELEASE_VERSION" && "$RELEASE_BUMP" != "patch" ]] && \
  die "specify only one of --release-bump or --release-version"

require_cmd jq
require_cmd git
require_cmd awk
require_cmd sed
[[ "$NO_PR" == "1" ]] || require_cmd forge
[[ "$NO_PR" == "1" ]] || require_cmd gh

# resolve plugin version
current_version="$(read_plugin_version "$PLUGIN")"
log info "current $PLUGIN version: $current_version"
if [[ -n "$BUMP" ]]; then
  VERSION="$(bump_semver "$current_version" "$BUMP")"
fi
is_semver "$VERSION" || die "invalid target plugin version: $VERSION"
semver_gt "$VERSION" "$current_version" || \
  die "target $VERSION not greater than current $current_version"

# resolve release (marketplace) version
current_meta="$(read_marketplace_metadata_version)"
if [[ -z "$RELEASE_VERSION" ]]; then
  RELEASE_VERSION="$(bump_semver "$current_meta" "$RELEASE_BUMP")"
fi
is_semver "$RELEASE_VERSION" || die "invalid target release version: $RELEASE_VERSION"
semver_gt "$RELEASE_VERSION" "$current_meta" || \
  die "release version $RELEASE_VERSION not greater than current metadata.version $current_meta"
# Invariant for verify-versions: metadata.version >= max(plugin versions)
if semver_gt "$VERSION" "$RELEASE_VERSION"; then
  die "plugin version $VERSION is greater than release version $RELEASE_VERSION; pass --release-version $VERSION (or higher)"
fi

DATE="$(date +%Y-%m-%d)"
BRANCH="release/v${RELEASE_VERSION}"
log info "release version: v${RELEASE_VERSION} (was v${current_meta})"
log info "plugin ${PLUGIN}:     v${VERSION} (was v${current_version})"
log info "date: $DATE, branch: $BRANCH"

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

write_plugin_version "$PLUGIN" "$VERSION"
write_marketplace_plugin_version "$PLUGIN" "$VERSION"
write_marketplace_metadata_version "$RELEASE_VERSION"

promote_unreleased "$RELEASE_VERSION" "$DATE"
generate_release_notes "$RELEASE_VERSION" "$DATE"

# ---------- post-condition ----------

log info "running verify-versions.sh (post-condition)..."
if [[ "$DRY_RUN" == "1" ]]; then
  log info "[dry-run] skipping verify (files not actually modified)"
else
  "$SCRIPT_DIR/verify-versions.sh"
fi

# ---------- confirm & commit ----------

if [[ "$DRY_RUN" == "1" ]]; then
  log ok "dry-run complete; no changes written, no branch created"
  exit 0
fi

confirm_typed "v${RELEASE_VERSION}" "About to commit & push branch ${BRANCH}."

git add \
  ".claude-plugin/marketplace.json" \
  "$(plugin_json "$PLUGIN")" \
  "CHANGELOG.md" \
  "releases/v${RELEASE_VERSION}.md"

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

pr_body="$(cat <<EOF
## Summary

- リポジトリリリース版を v${current_meta} → v${RELEASE_VERSION} に bump
- プラグイン \`${PLUGIN}\` を v${current_version} → v${VERSION} に bump
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

forge gh pr-create --base master \
  --title "chore(release): v${RELEASE_VERSION}" \
  --body "$pr_body"
log ok "PR opened"

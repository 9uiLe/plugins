#!/usr/bin/env bash
# release-prepare.sh — prepare a release branch and open a PR.
#
# Usage:
#   scripts/release-prepare.sh --plugin <name> (--bump patch|minor|major | --version X.Y.Z)
#                              [--marketplace-bump] [--dry-run] [--yes] [--no-pr]
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
MARKETPLACE_BUMP=0
NO_PR=0

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plugin)            PLUGIN="$2"; shift 2 ;;
    --bump)              BUMP="$2"; shift 2 ;;
    --version)           VERSION="$2"; shift 2 ;;
    --marketplace-bump)  MARKETPLACE_BUMP=1; shift ;;
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

require_cmd jq
require_cmd git
require_cmd awk
require_cmd sed
[[ "$NO_PR" == "1" ]] || require_cmd forge
[[ "$NO_PR" == "1" ]] || require_cmd gh

# resolve version
current_version="$(read_plugin_version "$PLUGIN")"
log info "current $PLUGIN version: $current_version"
if [[ -n "$BUMP" ]]; then
  VERSION="$(bump_semver "$current_version" "$BUMP")"
fi
is_semver "$VERSION" || die "invalid target version: $VERSION"
semver_gt "$VERSION" "$current_version" || die "target $VERSION not greater than current $current_version"

DATE="$(date +%Y-%m-%d)"
BRANCH="release/v${VERSION}"
log info "target version: $VERSION (date: $DATE, branch: $BRANCH)"

# ---------- preflight ----------

if [[ "$DRY_RUN" != "1" ]]; then
  require_clean_worktree
  require_branch master
  log info "fetching origin..."
  git fetch origin master --quiet
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse origin/master)"
  [[ "$local_sha" == "$remote_sha" ]] || die "local master is not in sync with origin/master"
  ! git rev-parse "refs/tags/v${VERSION}" >/dev/null 2>&1 || die "tag v${VERSION} already exists"
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

if [[ "$MARKETPLACE_BUMP" == "1" ]]; then
  meta_ver="$(read_marketplace_metadata_version)"
  if semver_gt "$VERSION" "$meta_ver"; then
    write_marketplace_metadata_version "$VERSION"
  else
    log info "metadata.version ($meta_ver) already >= $VERSION; not changed"
  fi
fi

promote_unreleased "$VERSION" "$DATE"
generate_release_notes "$VERSION" "$DATE"

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

confirm_typed "v${VERSION}" "About to commit & push branch ${BRANCH}."

git add \
  ".claude-plugin/marketplace.json" \
  "$(plugin_json "$PLUGIN")" \
  "CHANGELOG.md" \
  "releases/v${VERSION}.md"

git commit -m "chore(release): v${VERSION}" >/dev/null
log ok "committed: chore(release): v${VERSION}"

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

- ${PLUGIN} を v${VERSION} にバージョンアップ
- \`CHANGELOG.md\` の [Unreleased] を [${VERSION}] - ${DATE} に繰り上げ
- \`releases/v${VERSION}.md\` 雛形を生成（マージ前にハイライト本文を加筆してください）

## Release notes

詳細は \`releases/v${VERSION}.md\` を参照。

## Test plan

- [ ] CI green (\`verify-versions\` を含む)
- [ ] \`/plugin marketplace add\` で v${VERSION} として認識されること
- [ ] 対象 Skill を 1 回実行して回帰がないこと
EOF
)"

forge gh pr-create --base master \
  --title "chore(release): v${VERSION}" \
  --body "$pr_body"
log ok "PR opened"

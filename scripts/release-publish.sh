#!/usr/bin/env bash
# release-publish.sh — tag a merged release commit and publish a GitHub Release.
#
# Run this AFTER the release PR has been merged into master.
#
# Usage:
#   scripts/release-publish.sh --version X.Y.Z [--dry-run] [--yes]

set -euo pipefail
export SCRIPT_NAME="release-publish"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --dry-run) export DRY_RUN=1; shift ;;
    --yes)     export ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)         die "unknown argument: $1" ;;
  esac
done

[[ -n "$VERSION" ]] || die "missing --version"
is_semver "$VERSION" || die "invalid semver: $VERSION"

require_cmd git
require_cmd gh

TAG="v${VERSION}"
NOTES_FILE="$REPO_ROOT/releases/${TAG}.md"
[[ -f "$NOTES_FILE" ]] || die "release notes not found: $NOTES_FILE"

if [[ "$DRY_RUN" != "1" ]]; then
  require_clean_worktree
  require_branch master
  log info "fetching origin..."
  git fetch origin master --tags --quiet
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse origin/master)"
  [[ "$local_sha" == "$remote_sha" ]] || die "local master is not in sync with origin/master"
  ! git rev-parse "refs/tags/${TAG}" >/dev/null 2>&1 || die "tag ${TAG} already exists locally"
  if git ls-remote --tags origin "refs/tags/${TAG}" | grep -q "${TAG}"; then
    die "tag ${TAG} already exists on origin"
  fi
fi

log info "release target: ${TAG} at $(git rev-parse --short HEAD)"

confirm_typed "$TAG" "About to create annotated tag ${TAG} and publish a GitHub Release."

run git tag -a "$TAG" -m "$TAG"
run git push origin "$TAG"
log ok "tag pushed: $TAG"

run gh release create "$TAG" \
  --title "$TAG" \
  --notes-file "$NOTES_FILE" \
  --latest
log ok "GitHub Release published: $TAG"

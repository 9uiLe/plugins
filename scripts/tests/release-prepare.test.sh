#!/usr/bin/env bash
# release-prepare.test.sh — acceptance tests for scripts/release-prepare.sh.
#
# Each scenario runs release-prepare.sh against a fixture git repository whose
# origin is a local bare repository, then inspects the resulting CHANGELOG,
# release notes, manifests, and release commit. Nothing touches this repository.
set -euo pipefail

# shellcheck source=helpers.sh
. "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Isolate fixture commits from the developer's git config (signing, hooks, identity).
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

TODAY="$(date +%Y-%m-%d)"
COMPARE="https://github.com/9uiLe/plugins/compare"
UNRELEASED_BODY='### Added

- alpha: new feature'

# make_release_fixture <dir> — alpha 1.0.0, bravo 0.3.0, metadata.version 1.0.0,
# latest CHANGELOG release 1.0.0, pushed to a bare origin on master.
make_release_fixture() {
  local fixture="$1"
  rm -rf "$fixture.origin.git"
  make_fixture "$fixture"
  add_plugin "$fixture" bravo 0.3.0
  cat >"$fixture/CHANGELOG.md" <<EOF
# Changelog

## [Unreleased]

$UNRELEASED_BODY

## [1.0.0] - 2026-01-02

### Added

- alpha: initial release

## [0.9.0] - 2026-01-01

### Added

- bravo: initial release

[Unreleased]: $COMPARE/v1.0.0...HEAD
[1.0.0]: $COMPARE/v0.9.0...v1.0.0
[0.9.0]: https://github.com/9uiLe/plugins/releases/tag/v0.9.0
EOF
  git -C "$fixture" init -q --initial-branch=master
  git -C "$fixture" add -A
  git -C "$fixture" commit -q -m fixture
  git init -q --bare "$fixture.origin.git"
  git -C "$fixture" remote add origin "$fixture.origin.git"
  git -C "$fixture" push -q -u origin master
}

# prepare <fixture> <release-prepare args...> — run without prompts or PR creation
prepare() {
  local fixture="$1"
  shift
  (cd "$fixture" && bash scripts/release-prepare.sh --yes --no-pr "$@")
}

# committed_files <fixture> — files changed by the release commit, one per line, sorted
committed_files() {
  git -C "$1" show --name-only --format= HEAD | LC_ALL=C sort
}

# plugin_versions <fixture> <name> — "<claude> <codex> <marketplace>" versions of a plugin
plugin_versions() {
  local fixture="$1" name="$2"
  printf '%s %s %s' \
    "$(jq -r '.version' "$fixture/plugins/$name/.claude-plugin/plugin.json")" \
    "$(jq -r '.version' "$fixture/plugins/$name/.codex-plugin/plugin.json")" \
    "$(jq -r --arg n "$name" '.plugins[] | select(.name == $n) | .version' "$fixture/.claude-plugin/marketplace.json")"
}

metadata_version() {
  jq -r '.metadata.version' "$1/.claude-plugin/marketplace.json"
}

fixture="$WORK_DIR/fixture"

# ---------- CHANGELOG promotion & release notes ----------

make_release_fixture "$fixture"
if out="$(prepare "$fixture" --plugin alpha:patch 2>&1)"; then
  pass "release with a non-empty [Unreleased] succeeds"
  changelog="$(cat "$fixture/CHANGELOG.md")"

  assert_contains "promoted section gets version and date heading and keeps the [Unreleased] body" "$changelog" \
    "## [1.0.1] - $TODAY

$UNRELEASED_BODY"
  assert_contains "[Unreleased] is left empty above the new section" "$changelog" \
    "## [Unreleased]

## [1.0.1] - $TODAY"
  assert_eq "promoted body appears exactly once" 1 "$(grep -c '^- alpha: new feature$' "$fixture/CHANGELOG.md")"
  assert_contains "earlier release sections are preserved" "$changelog" \
    "## [1.0.0] - 2026-01-02

### Added

- alpha: initial release"
  assert_contains "compare links point [Unreleased] at the new tag and the new tag at the previous release" "$changelog" \
    "[Unreleased]: $COMPARE/v1.0.1...HEAD
[1.0.1]: $COMPARE/v1.0.0...v1.0.1
[1.0.0]: $COMPARE/v0.9.0...v1.0.0"

  notes_file="$fixture/releases/v1.0.1.md"
  if [[ -f "$notes_file" ]]; then
    notes="$(cat "$notes_file")"
    assert_contains "release notes title carries the release version" "$notes" "# Release Notes — v1.0.1"
    assert_contains "release notes carry the release date" "$notes" "リリース日: $TODAY"
    assert_contains "release notes include the promoted body" "$notes" "$UNRELEASED_BODY"
    for section in "## ハイライト" "## Compatibility / Migration" "## References"; do
      assert_contains "release notes have section: $section" "$notes" "$section"
    done
    assert_contains "release notes compare against the previous release" "$notes" \
      "Compare: <$COMPARE/v1.0.0...v1.0.1>"
  else
    fail "release notes are written to releases/v1.0.1.md" "file not found"
  fi

  assert_eq "release version is written to metadata.version" "1.0.1" \
    "$(metadata_version "$fixture")"
  assert_eq "release commit is on release/v1.0.1" "release/v1.0.1" \
    "$(git -C "$fixture" rev-parse --abbrev-ref HEAD)"
  expect_success "released repository satisfies verify-versions" bash "$fixture/scripts/verify-versions.sh"
else
  fail "release with a non-empty [Unreleased] succeeds" "release-prepare failed" "$out"
fi

make_release_fixture "$fixture"
awk '/^## \[Unreleased\]/ { print; skip=1; next } skip && /^## \[/ { skip=0 } !skip' \
  "$fixture/CHANGELOG.md" >"$fixture/CHANGELOG.md.tmp"
mv "$fixture/CHANGELOG.md.tmp" "$fixture/CHANGELOG.md"
git -C "$fixture" commit -q -am "empty unreleased"
git -C "$fixture" push -q origin master
expect_failure_with "empty [Unreleased] is rejected" "[Unreleased] section is empty" \
  prepare "$fixture" --plugin alpha:patch

# ---------- dry-run ----------

dry="$WORK_DIR/dry"
make_release_fixture "$dry"
make_release_fixture "$fixture"
if dry_out="$(prepare "$dry" --plugin alpha:patch --dry-run 2>&1)"; then
  pass "dry-run succeeds"
  assert_eq "dry-run leaves the worktree unchanged" "" "$(git -C "$dry" status --porcelain)"
  assert_eq "dry-run creates no release branch" "" "$(git -C "$dry" branch --list 'release/*')"
  if prepare "$fixture" --plugin alpha:patch >/dev/null 2>&1; then
    assert_contains "dry-run previews the same release notes the real run writes" "$dry_out" \
      "$(cat "$fixture/releases/v1.0.1.md")"
  else
    fail "dry-run previews the same release notes the real run writes" "real run failed"
  fi
else
  fail "dry-run succeeds" "release-prepare --dry-run failed" "$dry_out"
fi

# ---------- plugin changes (0...N) and release version ----------

make_release_fixture "$fixture"
if out="$(prepare "$fixture" 2>&1)"; then
  pass "release without plugin changes succeeds"
  assert_eq "release without selector is a patch bump of metadata.version" "1.0.1" "$(metadata_version "$fixture")"
  assert_eq "release without plugin changes leaves alpha unchanged" "1.0.0 1.0.0 1.0.0" "$(plugin_versions "$fixture" alpha)"
  assert_eq "release without plugin changes leaves bravo unchanged" "0.3.0 0.3.0 0.3.0" "$(plugin_versions "$fixture" bravo)"
  assert_eq "release without plugin changes commits no plugin manifest" \
    ".claude-plugin/marketplace.json
CHANGELOG.md
releases/v1.0.1.md" "$(committed_files "$fixture")"
else
  fail "release without plugin changes succeeds" "release-prepare failed" "$out"
fi

make_release_fixture "$fixture"
if out="$(prepare "$fixture" --plugin alpha:patch 2>&1)"; then
  pass "single plugin change succeeds"
  assert_eq "single plugin change bumps the plugin in every manifest" "1.0.1 1.0.1 1.0.1" "$(plugin_versions "$fixture" alpha)"
  assert_eq "single plugin change leaves other plugins unchanged" "0.3.0 0.3.0 0.3.0" "$(plugin_versions "$fixture" bravo)"
  assert_eq "single plugin change commits only that plugin's manifests" \
    ".claude-plugin/marketplace.json
CHANGELOG.md
plugins/alpha/.claude-plugin/plugin.json
plugins/alpha/.codex-plugin/plugin.json
releases/v1.0.1.md" "$(committed_files "$fixture")"
else
  fail "single plugin change succeeds" "release-prepare failed" "$out"
fi

make_release_fixture "$fixture"
if out="$(prepare "$fixture" --plugin alpha:minor --plugin bravo:0.5.0 --release-bump minor 2>&1)"; then
  pass "multiple plugin changes succeed"
  assert_eq "bump kind is applied to its own plugin" "1.1.0 1.1.0 1.1.0" "$(plugin_versions "$fixture" alpha)"
  assert_eq "explicit version is applied to its own plugin" "0.5.0 0.5.0 0.5.0" "$(plugin_versions "$fixture" bravo)"
  assert_eq "--release-bump selects the release version once for all plugin changes" "1.1.0" "$(metadata_version "$fixture")"
  assert_eq "multiple plugin changes produce one release section" 1 \
    "$(grep -c '^## \[[0-9]*\.[0-9]*\.[0-9]*\] - '"$TODAY"'$' "$fixture/CHANGELOG.md")"
  assert_eq "multiple plugin changes produce one release commit" 1 \
    "$(git -C "$fixture" rev-list --count master..HEAD)"
  assert_eq "multiple plugin changes commit every changed manifest" \
    ".claude-plugin/marketplace.json
CHANGELOG.md
plugins/alpha/.claude-plugin/plugin.json
plugins/alpha/.codex-plugin/plugin.json
plugins/bravo/.claude-plugin/plugin.json
plugins/bravo/.codex-plugin/plugin.json
releases/v1.1.0.md" "$(committed_files "$fixture")"
else
  fail "multiple plugin changes succeed" "release-prepare failed" "$out"
fi

make_release_fixture "$dry"
if dry_out="$(prepare "$dry" --plugin alpha:minor --plugin bravo:patch --release-version 2.0.0 --dry-run 2>&1)"; then
  pass "dry-run with multiple plugin changes succeeds"
  assert_contains "--release-version selects the release version" "$dry_out" "release version: v2.0.0 (was v1.0.0)"
  assert_contains "dry-run lists every manifest it would stage" "$dry_out" \
    "would stage: .claude-plugin/marketplace.json CHANGELOG.md releases/v2.0.0.md plugins/alpha/.claude-plugin/plugin.json plugins/alpha/.codex-plugin/plugin.json plugins/bravo/.claude-plugin/plugin.json plugins/bravo/.codex-plugin/plugin.json"
  assert_contains "PR body lists every plugin change" "$dry_out" \
    "- リポジトリリリース版を v1.0.0 → v2.0.0 に bump
- プラグイン \`alpha\` を v1.0.0 → v1.1.0 に bump
- プラグイン \`bravo\` を v0.3.0 → v0.3.1 に bump"
else
  fail "dry-run with multiple plugin changes succeeds" "release-prepare --dry-run failed" "$dry_out"
fi

if dry_out="$(prepare "$dry" --dry-run 2>&1)"; then
  assert_contains "dry-run without plugin changes stages no plugin manifest" "$dry_out" \
    "would stage: .claude-plugin/marketplace.json CHANGELOG.md releases/v1.0.1.md"$'\n'
  assert_not_contains "PR body without plugin changes lists no plugin" "$dry_out" "- プラグイン"
else
  fail "dry-run without plugin changes succeeds" "release-prepare --dry-run failed" "$dry_out"
fi

# ---------- rejected input (validated before any side effect) ----------

expect_failure_with "--release-bump and --release-version together are rejected" \
  "specify at most one release selector" prepare "$dry" --release-bump patch --release-version 1.0.5 --dry-run
expect_failure_with "--release-version and --release-bump together are rejected" \
  "specify at most one release selector" prepare "$dry" --release-version 1.0.5 --release-bump patch --dry-run
expect_failure_with "plugin version above the release version is rejected" \
  "plugin alpha version 1.1.0 is greater than release version 1.0.1" prepare "$dry" --plugin alpha:minor --dry-run
expect_failure_with "same plugin specified twice is rejected" \
  "plugin alpha is specified more than once" prepare "$dry" --plugin alpha:patch --plugin alpha:patch --dry-run
expect_failure_with "unknown plugin is rejected" \
  "unknown plugin: zeta" prepare "$dry" --plugin zeta:patch --dry-run
expect_failure_with "--plugin without a version change is rejected" \
  "expected <name>:<patch|minor|major|X.Y.Z>" prepare "$dry" --plugin alpha --dry-run
expect_failure_with "invalid plugin bump kind is rejected" \
  "'huge' is neither patch|minor|major nor X.Y.Z" prepare "$dry" --plugin alpha:huge --dry-run
expect_failure_with "invalid plugin semver is rejected" \
  "'1.2' is neither patch|minor|major nor X.Y.Z" prepare "$dry" --plugin alpha:1.2 --dry-run
expect_failure_with "invalid release bump kind is rejected" \
  "invalid --release-bump: huge" prepare "$dry" --release-bump huge --dry-run
expect_failure_with "invalid release semver is rejected" \
  "invalid target release version: 1.2" prepare "$dry" --release-version 1.2 --dry-run
assert_eq "rejected input leaves the worktree unchanged" "" "$(git -C "$dry" status --porcelain)"

# ---------- failed preparation leaves no partial state ----------

# repo_state <fixture> — branch, HEAD, all refs, and worktree status
repo_state() {
  git -C "$1" rev-parse --abbrev-ref HEAD
  git -C "$1" rev-parse HEAD
  git -C "$1" for-each-ref --format='%(refname) %(objectname)'
  git -C "$1" status --porcelain
}

# expect_failure_leaves_repo_unchanged <label> <diagnostic> <fixture> <release-prepare args...>
expect_failure_leaves_repo_unchanged() {
  local label="$1" needle="$2" fixture="$3" before
  shift 3
  before="$(repo_state "$fixture")"
  expect_failure_with "$label: fails" "$needle" prepare "$fixture" "$@"
  assert_eq "$label: leaves branch, commits, and files unchanged" "$before" "$(repo_state "$fixture")"
  assert_eq "$label: leaves no release branch" "" "$(git -C "$fixture" branch --list 'release/*')"
}

make_release_fixture "$fixture"
mkdir -p "$fixture/releases"
printf 'existing notes\n' >"$fixture/releases/v1.0.1.md"
git -C "$fixture" add releases
git -C "$fixture" commit -q -m "existing notes"
git -C "$fixture" push -q origin master
expect_failure_leaves_repo_unchanged "existing release notes" "release notes already exist" \
  "$fixture" --plugin alpha:patch
assert_eq "existing release notes: keeps the existing notes" "existing notes" "$(cat "$fixture/releases/v1.0.1.md")"

# A regular file named releases/ makes writing the notes fail after the
# manifests and CHANGELOG have already been modified on the release branch.
make_release_fixture "$fixture"
printf 'not a directory\n' >"$fixture/releases"
git -C "$fixture" add releases
git -C "$fixture" commit -q -m "block releases dir"
git -C "$fixture" push -q origin master
expect_failure_leaves_repo_unchanged "failure after files are modified" "releases" \
  "$fixture" --plugin alpha:patch --plugin bravo:patch

make_release_fixture "$fixture"
printf '#!/bin/sh\nexit 1\n' >"$fixture.origin.git/hooks/pre-receive"
chmod +x "$fixture.origin.git/hooks/pre-receive"
expect_failure_leaves_repo_unchanged "rejected push after the release commit" "rejected" \
  "$fixture" --plugin alpha:patch

finish release-prepare

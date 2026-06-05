#!/usr/bin/env bash
# release-notes.sh — scaffold releases/vX.Y.Z.md from CHANGELOG section
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
# shellcheck source=changelog.sh
. "$(dirname "${BASH_SOURCE[0]}")/changelog.sh"

RELEASES_DIR="$REPO_ROOT/releases"

# extract_section <version> — body of [X.Y.Z] section from CHANGELOG.md
extract_section() {
  local version="$1"
  awk -v v="$version" '
    $0 ~ "^## \\[" v "\\]" { capture=1; next }
    capture && /^## \[/ { exit }
    capture { print }
  ' "$CHANGELOG"
}

# generate_release_notes <version> <date>
generate_release_notes() {
  local version="$1" date="$2"
  is_semver "$version" || die "invalid semver: $version"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "invalid date: $date"

  local prev
  prev="$(awk -v v="$version" '
    /^## \[[0-9]+\.[0-9]+\.[0-9]+\]/ {
      match($0, /[0-9]+\.[0-9]+\.[0-9]+/)
      ver = substr($0, RSTART, RLENGTH)
      if (ver == v) { found=1; next }
      if (found) { print ver; exit }
    }
  ' "$CHANGELOG")"
  # In --dry-run, CHANGELOG hasn't been promoted yet, so the new [X.Y.Z] heading
  # is absent. Fall back to the current latest released version.
  if [[ -z "$prev" && "$DRY_RUN" == "1" ]]; then
    prev="$(previous_version)"
  fi
  [[ -n "$prev" ]] || die "could not find previous version before $version in CHANGELOG.md"

  local out="$RELEASES_DIR/v${version}.md"
  if [[ -e "$out" && "$DRY_RUN" != "1" ]]; then
    die "release notes already exist: $out"
  fi

  local body
  body="$(extract_section "$version")"
  # In --dry-run, the [X.Y.Z] heading doesn't exist yet; preview against the
  # [Unreleased] body instead (that's what promote_unreleased will copy over).
  if [[ -z "${body// /}" && "$DRY_RUN" == "1" ]]; then
    body="$(extract_unreleased)"
  fi
  if [[ -z "${body// /}" ]]; then
    die "CHANGELOG section [$version] is empty; promote it first"
  fi

  local content
  content="$(cat <<EOF
# Release Notes — v${version}

リリース日: ${date}

> このファイルは雛形です。\`## ハイライト\` を手で書き加え、必要に応じて節の説明を膨らませてください。

## ハイライト

- TODO: 1〜3 行で主要な変更点を要約する

$(printf '%s' "$body")

## Compatibility / Migration

- TODO: 破壊的変更の有無、移行手順、後方互換性の注意点を記載する。

## References

- CHANGELOG: [\`CHANGELOG.md\`](../CHANGELOG.md)
- Compare: <https://github.com/9uiLe/plugins/compare/v${prev}...v${version}>
EOF
)"

  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would write $out:"
    printf '%s\n' "$content" >&2
  else
    mkdir -p "$RELEASES_DIR"
    printf '%s\n' "$content" >"$out"
    log ok "wrote $out"
  fi
}

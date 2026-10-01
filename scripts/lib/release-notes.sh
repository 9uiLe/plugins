#!/usr/bin/env bash
# release-notes.sh — scaffold releases/vX.Y.Z.md from release data
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

RELEASES_DIR="$REPO_ROOT/releases"

# release_notes_path <version>
release_notes_path() {
  printf '%s/v%s.md\n' "$RELEASES_DIR" "$1"
}

# generate_release_notes <version> <date YYYY-MM-DD> <previous-version> <body>
generate_release_notes() {
  local version="$1" date="$2" prev="$3" body="$4"
  is_semver "$version" || die "invalid semver: $version"
  is_semver "$prev" || die "invalid semver: $prev"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "invalid date: $date"

  local out
  out="$(release_notes_path "$version")"

  local content
  content="$(cat <<EOF
# Release Notes — v${version}

リリース日: ${date}

> このファイルは雛形です。\`## ハイライト\` を手で書き加え、必要に応じて節の説明を膨らませてください。

## ハイライト

- TODO: 1〜3 行で主要な変更点を要約する

${body}

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

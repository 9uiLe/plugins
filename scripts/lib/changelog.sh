#!/usr/bin/env bash
# changelog.sh — read release data from CHANGELOG.md and promote [Unreleased] to [X.Y.Z]
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

CHANGELOG="$REPO_ROOT/CHANGELOG.md"

# unreleased_body — body of [Unreleased] without the heading and surrounding blank lines
unreleased_body() {
  local body
  body="$(awk '
    /^## \[Unreleased\]/ { capture=1; next }
    capture && /^## \[/ { exit }
    capture { print }
  ' "$CHANGELOG" | awk 'BEGIN{blank=1} { if(NF||!blank){print; blank=0} }' | sed -e :a -e '/^$/{$d;N;ba' -e '}')"
  [[ -n "$body" ]] || die "[Unreleased] section is empty; nothing to promote"
  printf '%s\n' "$body"
}

# latest_release_version — X.Y.Z of the newest released section
# Uses POSIX awk (match + RSTART/RLENGTH) so it works under BSD awk on macOS.
latest_release_version() {
  local version
  version="$(awk '
    /^## \[[0-9]+\.[0-9]+\.[0-9]+\]/ {
      match($0, /[0-9]+\.[0-9]+\.[0-9]+/)
      print substr($0, RSTART, RLENGTH)
      exit
    }
  ' "$CHANGELOG")"
  [[ -n "$version" ]] || die "no previous released version found in CHANGELOG.md"
  printf '%s\n' "$version"
}

# promote_unreleased <new-version> <date YYYY-MM-DD> <previous-version> <body>
# Moves <body> under a new [X.Y.Z] heading and links it against <previous-version>.
# Rewrites CHANGELOG.md in place (or prints diff in dry-run).
promote_unreleased() {
  local new="$1" date="$2" prev="$3" body="$4"
  is_semver "$new" || die "invalid semver: $new"
  is_semver "$prev" || die "invalid semver: $prev"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "invalid date (YYYY-MM-DD): $date"

  local tmp
  tmp="$(mktemp)"
  awk -v new="$new" -v date="$date" -v prev="$prev" '
    BEGIN {
      in_unreleased = 0
      printed_new = 0
    }
    # Replace the Unreleased heading with empty Unreleased + new section heading
    /^## \[Unreleased\]/ {
      print "## [Unreleased]"
      print ""
      printf("## [%s] - %s\n", new, date)
      in_unreleased = 1
      printed_new = 1
      next
    }
    # Skip the old Unreleased body until next ## section, then resume
    in_unreleased {
      if ($0 ~ /^## \[/) {
        in_unreleased = 0
        print
        next
      }
      next
    }
    # Rewrite the [Unreleased] link reference
    /^\[Unreleased\]:/ {
      sub(/v[0-9]+\.[0-9]+\.[0-9]+\.\.\.HEAD/, "v" new "...HEAD")
      print
      # Insert a new [X.Y.Z] line right after [Unreleased]
      printf("[%s]: https://github.com/9uiLe/plugins/compare/v%s...v%s\n", new, prev, new)
      next
    }
    { print }
  ' "$CHANGELOG" >"$tmp"

  # Re-inject the promoted body under the new heading.
  # Pass body via ENVIRON because BSD awk's -v cannot carry literal newlines.
  local tmp2
  tmp2="$(mktemp)"
  BODY="$body" awk -v new="$new" '
    {
      print
      if ($0 ~ "^## \\[" new "\\]") {
        print ""
        print ENVIRON["BODY"]
      }
    }
  ' "$tmp" >"$tmp2"
  rm -f "$tmp"

  if [[ "$DRY_RUN" == "1" ]]; then
    log info "[dry-run] would rewrite CHANGELOG.md:"
    diff -u "$CHANGELOG" "$tmp2" || true
    rm -f "$tmp2"
  else
    mv "$tmp2" "$CHANGELOG"
    log ok "CHANGELOG.md promoted [Unreleased] -> [$new] - $date"
  fi
}

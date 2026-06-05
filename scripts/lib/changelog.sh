#!/usr/bin/env bash
# changelog.sh — promote [Unreleased] section to [X.Y.Z] in CHANGELOG.md
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

CHANGELOG="$REPO_ROOT/CHANGELOG.md"

# extract_unreleased — print body of [Unreleased] section (without the heading)
extract_unreleased() {
  awk '
    /^## \[Unreleased\]/ { capture=1; next }
    capture && /^## \[/ { exit }
    capture { print }
  ' "$CHANGELOG"
}

# previous_version — last released X.Y.Z heading, or empty if none
# Uses POSIX awk (match + RSTART/RLENGTH) so it works under BSD awk on macOS.
previous_version() {
  awk '
    /^## \[[0-9]+\.[0-9]+\.[0-9]+\]/ {
      match($0, /[0-9]+\.[0-9]+\.[0-9]+/)
      print substr($0, RSTART, RLENGTH)
      exit
    }
  ' "$CHANGELOG"
}

# promote_unreleased <new-version> <date YYYY-MM-DD>
# Rewrites CHANGELOG.md in place (or prints diff in dry-run).
promote_unreleased() {
  local new="$1" date="$2"
  is_semver "$new" || die "invalid semver: $new"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "invalid date (YYYY-MM-DD): $date"

  local body
  body="$(extract_unreleased)"
  # strip leading/trailing blank lines
  body="$(printf '%s' "$body" | awk 'BEGIN{blank=1} { if(NF||!blank){print; blank=0} } END{}' | sed -e :a -e '/^$/{$d;N;ba' -e '}')"
  if [[ -z "$body" ]]; then
    die "[Unreleased] section is empty; nothing to promote"
  fi

  local prev
  prev="$(previous_version)"
  [[ -n "$prev" ]] || die "no previous released version found in CHANGELOG.md"

  if ! semver_gt "$new" "$prev"; then
    die "new version $new is not greater than previous $prev"
  fi

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

#!/usr/bin/env bash
# common.sh — shared helpers for release scripts
# shellcheck shell=bash

set -euo pipefail

# Repository root (resolved relative to this file)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export REPO_ROOT

# Global flags (set by parent scripts; exported so child commands inherit them)
export DRY_RUN="${DRY_RUN:-0}"
export ASSUME_YES="${ASSUME_YES:-0}"
export SCRIPT_NAME="${SCRIPT_NAME:-release}"

# ---------- logging ----------

_color() {
  local code="$1"
  shift
  if [[ -t 2 ]]; then
    printf '\033[%sm%s\033[0m' "$code" "$*"
  else
    printf '%s' "$*"
  fi
}

log() {
  # usage: log <level> <message...>
  local level="$1"
  shift
  local prefix="${SCRIPT_NAME:-release}"
  local tag
  case "$level" in
    info)  tag="$(_color '36' '[INFO]')"  ;;
    warn)  tag="$(_color '33' '[WARN]')"  ;;
    error) tag="$(_color '31' '[ERROR]')" ;;
    ok)    tag="$(_color '32' '[OK]')"    ;;
    *)     tag="[$level]" ;;
  esac
  printf '[%s] %s %s\n' "$prefix" "$tag" "$*" >&2
}

die() {
  log error "$*"
  exit 1
}

# Run a command, but if DRY_RUN=1 just print it.
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '[%s] %s %s\n' "${SCRIPT_NAME:-release}" "$(_color '35' '[DRY-RUN]')" "$*" >&2
  else
    "$@"
  fi
}

# ---------- preflight ----------

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "required command not found: $cmd"
}

require_clean_worktree() {
  local out
  out="$(git status --porcelain)"
  if [[ -n "$out" ]]; then
    log error "working tree is not clean:"
    printf '%s\n' "$out" >&2
    die "commit or stash changes before running this script"
  fi
}

require_branch() {
  local expected="$1"
  local current
  current="$(git rev-parse --abbrev-ref HEAD)"
  [[ "$current" == "$expected" ]] || die "current branch is '$current', expected '$expected'"
}

# ---------- version helpers ----------

# SemVer X.Y.Z (no pre-release / metadata for now — see ADR-0001 Q3)
SEMVER_REGEX='^[0-9]+\.[0-9]+\.[0-9]+$'

is_semver() {
  [[ "$1" =~ $SEMVER_REGEX ]]
}

# bump_semver <current> <patch|minor|major>
bump_semver() {
  local current="$1" kind="$2"
  is_semver "$current" || die "invalid current version: $current"
  local major minor patch
  IFS='.' read -r major minor patch <<<"$current"
  case "$kind" in
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
    *) die "invalid bump kind: $kind (expected patch|minor|major)" ;;
  esac
  printf '%s.%s.%s' "$major" "$minor" "$patch"
}

# semver_gt <a> <b> — return 0 if a > b
semver_gt() {
  local a="$1" b="$2"
  is_semver "$a" || die "invalid semver: $a"
  is_semver "$b" || die "invalid semver: $b"
  local am an ap bm bn bp
  IFS='.' read -r am an ap <<<"$a"
  IFS='.' read -r bm bn bp <<<"$b"
  (( am != bm )) && { (( am > bm )); return; }
  (( an != bn )) && { (( an > bn )); return; }
  (( ap > bp ))
}

# ---------- interaction ----------

confirm() {
  # usage: confirm "<prompt>"
  local prompt="$1"
  if [[ "$ASSUME_YES" == "1" ]]; then
    log info "auto-confirm (--yes): $prompt"
    return 0
  fi
  local reply
  printf '[%s] %s [y/N] ' "${SCRIPT_NAME:-release}" "$prompt" >&2
  read -r reply </dev/tty || die "no tty available; pass --yes to skip prompts"
  [[ "$reply" =~ ^[Yy]$ ]] || die "aborted by user"
}

confirm_typed() {
  # usage: confirm_typed "<expected>" "<prompt>"
  local expected="$1" prompt="$2"
  if [[ "$ASSUME_YES" == "1" ]]; then
    log info "auto-confirm (--yes): $prompt"
    return 0
  fi
  local reply
  printf '[%s] %s\n  type "%s" to proceed: ' "${SCRIPT_NAME:-release}" "$prompt" "$expected" >&2
  read -r reply </dev/tty || die "no tty available; pass --yes to skip prompts"
  [[ "$reply" == "$expected" ]] || die "input did not match expected value; aborted"
}

# ---------- rollback ----------

# install_rollback_trap <branch-to-cleanup>
# Restores tracked files and (optionally) deletes the working branch on ERR/INT.
install_rollback_trap() {
  local branch="${1:-}"
  # shellcheck disable=SC2064
  trap "_rollback '$branch'" ERR INT
}

_rollback() {
  local branch="${1:-}"
  log warn "rollback triggered; restoring working tree"
  git restore --staged --worktree . 2>/dev/null || true
  git clean -fd -- 'releases/' 2>/dev/null || true
  if [[ -n "$branch" ]]; then
    local current
    current="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
    if [[ "$current" == "$branch" ]]; then
      git checkout master 2>/dev/null || true
      git branch -D "$branch" 2>/dev/null || true
      log warn "deleted working branch: $branch"
    fi
  fi
}

clear_rollback_trap() {
  trap - ERR INT
}

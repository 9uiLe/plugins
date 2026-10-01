"""Build the auth-service evaluation repository, including its git history.

Usage: python3 fixture_repo.py <destination>

Each directory under fixtures/auth-service/ is one commit, applied in name
order on top of the previous tree. The fix commit message is evidence for the
bug symptom, so it is kept verbatim. Prints JSON with the path and commits.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "auth-service"
MESSAGES = {
    "1-feature": "feat: login, refresh token rotation, and async client SDK",
    "2-fix": """fix(client): share one in-flight token refresh

Users were randomly logged out when several requests found the access
token expired at the same time. Each request called /token/refresh with
the same refresh token; the server treated the second use as refresh
token reuse and revoked the session.

TokenManager now keeps the in-flight refresh task and lets concurrent
callers await it. force_refresh() takes the rejected access token and
skips refreshing when another caller has already replaced it.""",
    "3-docs": "docs: add architecture overview",
}
# Fixed identity and dates make the commit SHAs reproducible across builds.
GIT_ENV = {
    "GIT_AUTHOR_NAME": "fixture", "GIT_AUTHOR_EMAIL": "fixture@example.com",
    "GIT_COMMITTER_NAME": "fixture", "GIT_COMMITTER_EMAIL": "fixture@example.com",
    "GIT_AUTHOR_DATE": "2026-09-01T00:00:00+00:00", "GIT_COMMITTER_DATE": "2026-09-01T00:00:00+00:00",
}


def git(destination, *args):
    result = subprocess.run(["git", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", *args],
                            cwd=destination, env={**os.environ, **GIT_ENV},
                            check=True, capture_output=True, text=True)
    return result.stdout.strip()


def build(destination):
    destination = Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise ValueError(f"destination is not empty: {destination}")
    destination.mkdir(parents=True, exist_ok=True)
    git(destination, "init", "-q")
    commits = []
    for layer in sorted(MESSAGES):
        shutil.copytree(FIXTURE / layer, destination, dirs_exist_ok=True)
        git(destination, "add", "-A")
        git(destination, "commit", "-q", "-m", MESSAGES[layer])
        commits.append({"layer": layer, "sha": git(destination, "rev-parse", "--short", "HEAD"),
                        "subject": MESSAGES[layer].splitlines()[0]})
    return {"path": str(destination), "commits": commits}


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        print(json.dumps(build(sys.argv[1]), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

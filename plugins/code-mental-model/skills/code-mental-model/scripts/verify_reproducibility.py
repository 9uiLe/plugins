#!/usr/bin/env python3
"""Render twice in isolated processes and compare hashes with the delivered HTML."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--model", type=Path, required=True)
    cli.add_argument("--html", type=Path)
    args = cli.parse_args()
    html = args.html or args.model.parent / "index.html"
    renderer = Path(__file__).with_name("render_html.py")
    with tempfile.TemporaryDirectory(prefix="mental-model-repro-") as directory:
        first, second = Path(directory) / "first.html", Path(directory) / "second.html"
        for target in (first, second):
            subprocess.run([sys.executable, str(renderer), "--model", str(args.model), "--output", str(target)], check=True, capture_output=True)
        digests = (sha(first), sha(second), sha(html))
    if len(set(digests)) != 1:
        raise ValueError(f"render mismatch: first={digests[0]} second={digests[1]} delivered={digests[2]}")
    print(f"OK: sha256(index.html)={digests[0]}")


if __name__ == "__main__":
    main()

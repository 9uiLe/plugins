#!/usr/bin/env python3
"""Validate the canonical model and its byte-level JSON serialization."""

from __future__ import annotations

import argparse
from pathlib import Path

from model_json import parse_model_json, serialize_model_json


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("model", type=Path)
    args = cli.parse_args()
    text = args.model.read_text(encoding="utf-8")
    document = parse_model_json(text)
    if text != serialize_model_json(document):
        raise ValueError("model is not canonically serialized as UTF-8 / LF / 2 spaces / final newline")
    print(f"OK: {args.model}")


if __name__ == "__main__":
    main()

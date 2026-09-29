"""Stable byte digests used for identities and artifact provenance."""

from __future__ import annotations

import hashlib


def stable_digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

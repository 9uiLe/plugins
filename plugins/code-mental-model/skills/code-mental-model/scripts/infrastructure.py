"""Filesystem, Git, and byte hashing at the application boundary."""

from __future__ import annotations

import json
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from artifact_metadata import TargetDigest
from domain import SourcePath, validate_source_path
from hashing import stable_digest


@dataclass(frozen=True, slots=True)
class SourceFile:
    path: SourcePath
    text: str
    sha256: str


@dataclass(frozen=True, slots=True)
class HtmlAssets:
    template: str
    css: str
    javascript: str


def read_html_assets(skill_root: Path) -> HtmlAssets:
    assets = skill_root / "assets"
    return HtmlAssets((assets / "template.html").read_text(encoding="utf-8"),
                      (assets / "mental-model.css").read_text(encoding="utf-8"),
                      (assets / "mental-model.js").read_text(encoding="utf-8"))


def git_revision(repo: Path) -> str:
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo,
                            text=True, capture_output=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else "none"


def read_source_files(repo: Path, names: Iterable[str]) -> tuple[SourceFile, ...]:
    files: list[SourceFile] = []
    for name in sorted(set(names)):
        source_path = SourcePath(name)
        validate_source_path(source_path)
        if name.startswith(".mental-model/"):
            raise ValueError("generated files cannot be targets")
        path = repo / name
        if not path.resolve().is_relative_to(repo.resolve()) or not path.is_file():
            raise ValueError(f"target is not a repository file: {name}")
        raw = path.read_bytes()
        files.append(SourceFile(source_path, raw.decode("utf-8"), stable_digest(raw)))
    if not files:
        raise ValueError("at least one --target is required")
    return tuple(files)


def target_digests(files: tuple[SourceFile, ...]) -> tuple[TargetDigest, ...]:
    return tuple(TargetDigest(file.path, file.sha256) for file in files)


def bundle_digests(skill_root: Path) -> dict[str, str]:
    assets = skill_root / "assets"
    scripts = skill_root / "scripts"
    paths = [skill_root / "SKILL.md", *assets.iterdir(), *(path for path in scripts.glob("*.py")
                                   if not path.name.startswith(("test_", "verify_", "validate_")))]
    return {str(path.relative_to(skill_root)): stable_digest(path.read_bytes())
            for path in sorted(paths) if path.is_file()}


def read_json_object(path: Path) -> dict[str, object]:
    raw: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or any(not isinstance(key, str) for key in raw):
        raise ValueError(f"JSON object required: {path}")
    return cast(dict[str, object], raw)


def write_utf8(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))

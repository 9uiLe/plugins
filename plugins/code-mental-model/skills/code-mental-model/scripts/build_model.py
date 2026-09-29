#!/usr/bin/env python3
"""CLI shell for canonical MentalModel construction and cache reuse."""

from __future__ import annotations

import argparse
from pathlib import Path

from analysis_json import parse_analysis_json
from artifact_metadata import ArtifactMetadata, BuildInputs, parse_metadata, serialize_metadata
from build_application import build_mental_model, needs_analysis
from infrastructure import (
    bundle_digests, git_revision, read_json_object, read_source_files,
    target_digests, write_utf8,
)
from model_json import ModelHeader, serialize_model_json
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--repo", type=Path, required=True)
    cli.add_argument("--analysis", type=Path, help="structured draft JSON; unnecessary when a matching model already exists")
    cli.add_argument("--target", action="append", default=[], help="repository-relative path; repeat for each source used by the model")
    cli.add_argument("--config", type=Path, help="optional JSON analysis configuration")
    cli.add_argument("--locale", choices=("ja-JP", "en-US"), default="ja-JP")
    cli.add_argument("--base", default="none", help="base revision identifier")
    cli.add_argument("--head", default="working-tree", help="head revision identifier")
    cli.add_argument("--output", type=Path, help="output directory; default <repo>/.mental-model")
    cli.add_argument("--force-analysis", action="store_true", help="explicitly rebuild even when fingerprint matches")
    args = cli.parse_args()
    repo: Path = args.repo.resolve()
    if not repo.is_dir():
        cli.error("--repo must be a directory")
    output: Path = args.output or repo / ".mental-model"
    metadata_path = output / "metadata.json"
    model_path = output / "mental-model.json"
    saved_metadata = parse_metadata(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else None
    previous_metadata: ArtifactMetadata | None = saved_metadata if not args.force_analysis else None
    previous_model_json = (model_path.read_text(encoding="utf-8")
                           if model_path.exists() and not args.force_analysis else None)
    names: list[str] = args.target or ([str(target.path) for target in saved_metadata.inputs.targets]
                                        if saved_metadata else [])
    files = read_source_files(repo, names)
    configuration = read_json_object(args.config) if args.config else {}
    inputs = BuildInputs(ModelHeader(SCHEMA_VERSION, RENDERER_VERSION, SKILL_VERSION, args.locale),
                         git_revision(repo), args.base, args.head, target_digests(files),
                         configuration, bundle_digests(Path(__file__).resolve().parent.parent))
    analysis = None
    if needs_analysis(inputs, previous_metadata, previous_model_json):
        if args.analysis is None:
            raise ValueError("input changed or model missing: provide --analysis with a structured draft")
        analysis = parse_analysis_json(args.analysis.read_text(encoding="utf-8"))
    result = build_mental_model(inputs, analysis, {file.path: file.text for file in files},
                                previous_metadata, previous_model_json)
    if result.reused:
        print(f"reused: {model_path}")
        return
    write_utf8(model_path, serialize_model_json(result.document))
    write_utf8(metadata_path, serialize_metadata(result.metadata))
    print(f"built: {model_path}")


if __name__ == "__main__":
    main()

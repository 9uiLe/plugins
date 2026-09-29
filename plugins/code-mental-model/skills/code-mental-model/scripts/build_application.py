"""Choose reuse or canonicalization from explicit, already-read inputs."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

from analysis_json import RawMentalModelAnalysis
from artifact_metadata import ArtifactMetadata, BuildInputs, input_fingerprint
from canonicalizer import canonicalize
from domain import SourcePath
from hashing import stable_digest
from model_json import ModelDocument, parse_model_json, serialize_model_json


@dataclass(frozen=True, slots=True)
class BuildResult:
    document: ModelDocument
    metadata: ArtifactMetadata
    reused: bool


def needs_analysis(inputs: BuildInputs,
                   previous_metadata: ArtifactMetadata | None,
                   previous_model_json: str | None) -> bool:
    return (previous_metadata is None or previous_model_json is None
            or previous_metadata.input_fingerprint != input_fingerprint(inputs))


def build_mental_model(inputs: BuildInputs,
                       analysis: RawMentalModelAnalysis | None,
                       contents: Mapping[SourcePath, str],
                       previous_metadata: ArtifactMetadata | None = None,
                       previous_model_json: str | None = None) -> BuildResult:
    fingerprint = input_fingerprint(inputs)
    if not needs_analysis(inputs, previous_metadata, previous_model_json):
        assert previous_metadata is not None and previous_model_json is not None
        document = parse_model_json(previous_model_json)
        if stable_digest(previous_model_json.encode("utf-8")) != previous_metadata.model_sha256:
            raise ValueError("existing canonical model differs from metadata; use --force-analysis with reviewed draft")
        return BuildResult(document, previous_metadata, True)
    if analysis is None:
        raise ValueError("input changed or model missing: provide --analysis with a structured draft")
    document = ModelDocument(inputs.header, canonicalize(analysis, contents))
    model_json = serialize_model_json(document)
    metadata = ArtifactMetadata(inputs, fingerprint, stable_digest(model_json.encode("utf-8")))
    return BuildResult(document, metadata, False)

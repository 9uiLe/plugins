"""Versioned provenance and input fingerprints, separate from the mental model."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import cast

from domain import SourcePath
from hashing import stable_digest
from model_json import ModelHeader


@dataclass(frozen=True, slots=True)
class TargetDigest:
    path: SourcePath
    sha256: str


@dataclass(frozen=True, slots=True)
class BuildInputs:
    header: ModelHeader
    repository_revision: str
    base_revision: str
    head_revision: str
    targets: tuple[TargetDigest, ...]
    analysis_configuration: dict[str, object]
    assets: dict[str, str]


@dataclass(frozen=True, slots=True)
class ArtifactMetadata:
    inputs: BuildInputs
    input_fingerprint: str
    model_sha256: str


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def _input_value(inputs: BuildInputs) -> dict[str, object]:
    header = inputs.header
    return {"skillVersion": header.skill_version, "schemaVersion": header.schema_version,
            "rendererVersion": header.renderer_version, "locale": header.locale,
            "repositoryRevision": inputs.repository_revision,
            "baseRevision": inputs.base_revision, "headRevision": inputs.head_revision,
            "targets": [{"path": target.path, "sha256": target.sha256} for target in inputs.targets],
            "analysisConfiguration": inputs.analysis_configuration, "assets": inputs.assets}


def input_fingerprint(inputs: BuildInputs) -> str:
    return stable_digest(canonical_json(_input_value(inputs)).encode("utf-8"))


def serialize_metadata(metadata: ArtifactMetadata) -> str:
    return canonical_json({**_input_value(metadata.inputs),
                           "inputFingerprint": metadata.input_fingerprint,
                           "modelSha256": metadata.model_sha256})


def _text_field(value: dict[str, object], key: str) -> str:
    field = value[key]
    if not isinstance(field, str):
        raise ValueError(f"invalid metadata field: {key}")
    return field


def parse_metadata(text: str) -> ArtifactMetadata:
    raw: object = json.loads(text)
    if not isinstance(raw, dict) or any(not isinstance(key, str) for key in raw):
        raise ValueError("metadata must be an object")
    value = cast(dict[str, object], raw)
    required = {"skillVersion", "schemaVersion", "rendererVersion", "locale",
                "repositoryRevision", "baseRevision", "headRevision", "targets",
                "analysisConfiguration", "assets", "inputFingerprint", "modelSha256"}
    if set(value) != required:
        raise ValueError("invalid metadata fields")
    schema, renderer = value["schemaVersion"], value["rendererVersion"]
    if type(schema) is not int or type(renderer) is not int:
        raise ValueError("invalid metadata versions")
    raw_targets = value["targets"]
    if not isinstance(raw_targets, list):
        raise ValueError("invalid metadata targets")
    targets: list[TargetDigest] = []
    for raw_target in raw_targets:
        if not isinstance(raw_target, dict) or set(raw_target) != {"path", "sha256"}:
            raise ValueError("invalid metadata target")
        if not isinstance(raw_target["path"], str) or not isinstance(raw_target["sha256"], str):
            raise ValueError("invalid metadata target values")
        targets.append(TargetDigest(SourcePath(raw_target["path"]), raw_target["sha256"]))
    configuration = value["analysisConfiguration"]
    assets = value["assets"]
    if not isinstance(configuration, dict) or not isinstance(assets, dict):
        raise ValueError("invalid metadata maps")
    if any(not isinstance(key, str) for key in configuration):
        raise ValueError("invalid analysis configuration")
    if any(not isinstance(key, str) or not isinstance(item, str) for key, item in assets.items()):
        raise ValueError("invalid asset digest")
    inputs = BuildInputs(ModelHeader(schema, renderer, _text_field(value, "skillVersion"),
                                    _text_field(value, "locale")),
                         _text_field(value, "repositoryRevision"),
                         _text_field(value, "baseRevision"),
                         _text_field(value, "headRevision"), tuple(targets),
                         cast(dict[str, object], configuration), cast(dict[str, str], assets))
    return ArtifactMetadata(inputs, _text_field(value, "inputFingerprint"),
                            _text_field(value, "modelSha256"))

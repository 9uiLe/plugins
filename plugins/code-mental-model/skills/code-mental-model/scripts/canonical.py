"""Compatibility adapters around the typed canonicalization boundary."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import cast

from analysis_json import parse_analysis_value
from artifact_metadata import canonical_json
from canonicalizer import canonicalize, slug
from domain import SourcePath
from hashing import stable_digest
from model_json import ModelDocument, ModelHeader, parse_model_json, serialize_model_json
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


def digest(value: bytes) -> str:
    return stable_digest(value)


def _version_number(versions: Mapping[str, object], key: str) -> int:
    value = versions[key]
    if type(value) is not int:
        raise ValueError(f"invalid {key}")
    return value


def _version_text(versions: Mapping[str, object], key: str) -> str:
    value = versions[key]
    if not isinstance(value, str):
        raise ValueError(f"invalid {key}")
    return value


def normalize(draft: object, contents: Mapping[str, str],
              versions: Mapping[str, object], locale: str) -> dict[str, object]:
    header = ModelHeader(_version_number(versions, "schemaVersion"),
                         _version_number(versions, "rendererVersion"),
                         _version_text(versions, "skillVersion"), locale)
    document = ModelDocument(header, canonicalize(parse_analysis_value(draft),
                                                   {SourcePath(path): text
                                                    for path, text in contents.items()}))
    serialized: object = json.loads(serialize_model_json(document))
    if not isinstance(serialized, dict):
        raise ValueError("canonical model must be an object")
    return cast(dict[str, object], serialized)


def validate_model(model: object) -> None:
    parse_model_json(canonical_json(model))

"""Validate an agent's draft JSON before canonicalization."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import PurePosixPath
from typing import TypeVar, cast

from domain import (
    Change, Condition, EdgeKind, EvidenceStatus, ExecutionScenario,
    ExecutionStep, Layer, LineNumber, NodeKind, RoleCode, SourceLocation,
    SourcePath, StateKind, SummaryCode,
)
from model_json import parse_change_tag


@dataclass(frozen=True, slots=True)
class RawNode:
    key: str
    label: str
    kind: NodeKind
    layer: Layer
    status: EvidenceStatus
    state: StateKind
    role_code: RoleCode
    source: SourceLocation | None


@dataclass(frozen=True, slots=True)
class RawEdge:
    from_key: str
    to_key: str
    kind: EdgeKind
    label: str
    data: str
    condition: Condition
    change: Change
    status: EvidenceStatus
    source: SourceLocation | None
    execution: tuple[tuple[ExecutionScenario, ExecutionStep], ...]


@dataclass(frozen=True, slots=True)
class RawMentalModelAnalysis:
    title: str
    summary_code: SummaryCode
    nodes: tuple[RawNode, ...]
    edges: tuple[RawEdge, ...]


EnumT = TypeVar("EnumT", bound=StrEnum)


def _mapping(value: object, name: str, required: set[str], allowed: set[str]) -> dict[str, object]:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name}: expected an object")
    result = cast(dict[str, object], value)
    if not required <= result.keys() or result.keys() - allowed:
        raise ValueError(f"{name}: required={sorted(required)}, unsupported={sorted(result.keys() - allowed)}")
    return result


def _items(value: object, name: str) -> list[object]:
    if not isinstance(value, list):
        raise ValueError(f"{name}: expected an array")
    return cast(list[object], value)


def _text(value: object, name: str, required: bool = False) -> str:
    if not isinstance(value, str) or (required and not value.strip()):
        raise ValueError(f"{name} must be {'nonempty ' if required else ''}text")
    return value


def _enum(value: object, kind: type[EnumT], name: str) -> EnumT:
    try:
        return kind(_text(value, name))
    except ValueError as error:
        raise ValueError(f"{name}: {value!r} is not in the controlled vocabulary") from error


def _source(value: object) -> SourceLocation | None:
    if value is None:
        return None
    item = _mapping(value, "source", {"path", "startLine", "endLine"},
                    {"path", "startLine", "endLine"})
    path = _text(item["path"], "source.path", True)
    if ("\\" in path or "\x00" in path or PurePosixPath(path).is_absolute()
            or PurePosixPath(path).as_posix() != path
            or any(part in (".", "..") for part in path.split("/"))):
        raise ValueError(f"path must be normalized and repository-relative: {path!r}")
    start, end = item["startLine"], item["endLine"]
    if type(start) is not int or type(end) is not int or start < 1 or end < start or end - start >= 25:
        raise ValueError(f"invalid source line range: {path}:{start}-{end}")
    return SourceLocation(SourcePath(path), LineNumber(start), LineNumber(end))


def _node(value: object) -> RawNode:
    item = _mapping(value, "node", {"key", "label", "kind", "layer", "status"},
                    {"key", "label", "kind", "layer", "status", "state", "roleCode", "source"})
    return RawNode(_text(item["key"], "node.key", True),
                   _text(item["label"], "node.label", True),
                   _enum(item["kind"], NodeKind, "node.kind"),
                   _enum(item["layer"], Layer, "node.layer"),
                   _enum(item["status"], EvidenceStatus, "node.status"),
                   _enum(item.get("state", "unknown"), StateKind, "node.state"),
                   _enum(item.get("roleCode", "unknown"), RoleCode, "node.roleCode"),
                   _source(item.get("source")))


def _edge(value: object) -> RawEdge:
    item = _mapping(value, "edge", {"from", "to", "kind", "label", "change", "status"},
                    {"from", "to", "kind", "label", "data", "condition", "change",
                     "status", "source", "execution"})
    execution_value = item.get("execution", {})
    if not isinstance(execution_value, dict) or any(not isinstance(key, str) for key in execution_value):
        raise ValueError("execution must map scenario names to positive integers")
    execution_map = cast(dict[str, object], execution_value)
    execution: list[tuple[ExecutionScenario, ExecutionStep]] = []
    for key, step in execution_map.items():
        if type(step) is not int or step < 1:
            raise ValueError("execution must map scenario names to positive integers")
        execution.append((ExecutionScenario(_text(key, "scenario", True)), ExecutionStep(step)))
    return RawEdge(_text(item["from"], "edge.from", True),
                   _text(item["to"], "edge.to", True),
                   _enum(item["kind"], EdgeKind, "edge.kind"),
                   _text(item["label"], "edge.label", True),
                   _text(item.get("data", ""), "edge.data"),
                   _enum(item.get("condition", "unknown"), Condition, "edge.condition"),
                   parse_change_tag(item["change"]),
                   _enum(item["status"], EvidenceStatus, "edge.status"),
                   _source(item.get("source")), tuple(execution))


def parse_analysis_value(value: object) -> RawMentalModelAnalysis:
    item = _mapping(value, "draft", {"title", "nodes", "edges"},
                    {"title", "summaryCode", "nodes", "edges"})
    nodes = tuple(_node(node) for node in _items(item["nodes"], "nodes"))
    edges = tuple(_edge(edge) for edge in _items(item["edges"], "edges"))
    if not nodes:
        raise ValueError("nonempty nodes and an edges array are required")
    return RawMentalModelAnalysis(_text(item["title"], "title", True),
                                  _enum(item.get("summaryCode", "unknown"), SummaryCode, "summaryCode"),
                                  nodes, edges)


def parse_analysis_json(text: str) -> RawMentalModelAnalysis:
    value: object = json.loads(text)
    return parse_analysis_value(value)

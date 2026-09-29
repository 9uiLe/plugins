"""Strict JSON boundary for canonical mental models."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import PurePosixPath
from typing import TypeVar, assert_never, cast

from domain import (
    Added, Change, Changed, CodeLens, CodeLine, CodeRange, Condition, Edge, EdgeId,
    EdgeKind, EvidenceStatus, ExecutionScenario, ExecutionStep, Existing,
    Layer, LineNumber, MentalModel, Node, NodeId, NodeKind, Removed,
    RoleCode, SourceLocation, SourcePath, StateKind, SummaryCode,
)
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


@dataclass(frozen=True, slots=True)
class ModelHeader:
    schema_version: int
    renderer_version: int
    skill_version: str
    locale: str


@dataclass(frozen=True, slots=True)
class ModelDocument:
    header: ModelHeader
    model: MentalModel


EnumT = TypeVar("EnumT", bound=StrEnum)


def _object(value: object, name: str, keys: set[str]) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != keys or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name}: expected exactly {sorted(keys)}")
    return cast(dict[str, object], value)


def _array(value: object, name: str) -> list[object]:
    if not isinstance(value, list):
        raise ValueError(f"{name}: expected an array")
    return cast(list[object], value)


def _text(value: object, name: str, *, nonempty: bool = False) -> str:
    if not isinstance(value, str) or (nonempty and not value.strip()):
        raise ValueError(f"{name}: expected {'nonempty ' if nonempty else ''}text")
    return value


def _positive(value: object, name: str) -> int:
    if type(value) is not int or value < 1:
        raise ValueError(f"{name}: expected a positive integer")
    return value


def _enum(value: object, kind: type[EnumT], name: str) -> EnumT:
    try:
        return kind(_text(value, name))
    except ValueError as error:
        raise ValueError(f"{name}: unsupported value {value!r}") from error


def _path(value: object) -> SourcePath:
    path = _text(value, "source path", nonempty=True)
    if ("\\" in path or "\x00" in path or PurePosixPath(path).is_absolute()
            or PurePosixPath(path).as_posix() != path
            or any(part in (".", "..") for part in path.split("/"))):
        raise ValueError(f"invalid repository-relative source path: {path!r}")
    return SourcePath(path)


def _source(value: object) -> SourceLocation | None:
    if value is None:
        return None
    obj = _object(value, "source", {"path", "startLine", "endLine"})
    start = _positive(obj["startLine"], "source.startLine")
    end = _positive(obj["endLine"], "source.endLine")
    if end < start or end - start >= 25:
        raise ValueError("source: invalid line range")
    return SourceLocation(_path(obj["path"]), LineNumber(start), LineNumber(end))


def _lens(value: object, source: SourceLocation | None) -> CodeLens | None:
    if value is None:
        if source is not None:
            raise ValueError("source requires a Code Lens")
        return None
    if source is None:
        raise ValueError("Code Lens requires a source")
    obj = _object(value, "codeLens", {"path", "startLine", "endLine", "focusStart", "focusEnd", "lines"})
    path = _path(obj["path"])
    start = _positive(obj["startLine"], "codeLens.startLine")
    end = _positive(obj["endLine"], "codeLens.endLine")
    focus_start = _positive(obj["focusStart"], "codeLens.focusStart")
    focus_end = _positive(obj["focusEnd"], "codeLens.focusEnd")
    if (path != source.path or focus_start != source.start_line or focus_end != source.end_line
            or start > focus_start or end < focus_end):
        raise ValueError("Code Lens does not match source")
    lines: list[CodeLine] = []
    for raw in _array(obj["lines"], "codeLens.lines"):
        line = _object(raw, "codeLens line", {"number", "text"})
        lines.append(CodeLine(LineNumber(_positive(line["number"], "codeLens line number")),
                              _text(line["text"], "codeLens line text")))
    if end < start or [line.number for line in lines] != list(range(start, end + 1)):
        raise ValueError("Code Lens lines must be continuous")
    return CodeLens(CodeRange(path, LineNumber(start), LineNumber(end)),
                    SourceLocation(path, LineNumber(focus_start), LineNumber(focus_end)),
                    tuple(lines))


def parse_change_tag(value: object) -> Change:
    changes: dict[str, Change] = {"existing": Existing(), "added": Added(),
                                  "removed": Removed(), "changed": Changed()}
    name = _text(value, "edge.change")
    if name not in changes:
        raise ValueError(f"edge.change: unsupported value {name!r}")
    return changes[name]


def _node(value: object) -> Node:
    obj = _object(value, "node", {"id", "label", "kind", "layer", "status", "state",
                                   "roleCode", "source", "codeLens"})
    source = _source(obj["source"])
    return Node(NodeId(_text(obj["id"], "node.id", nonempty=True)),
                _text(obj["label"], "node.label", nonempty=True),
                _enum(obj["kind"], NodeKind, "node.kind"),
                _enum(obj["layer"], Layer, "node.layer"),
                _enum(obj["status"], EvidenceStatus, "node.status"),
                _enum(obj["state"], StateKind, "node.state"),
                _enum(obj["roleCode"], RoleCode, "node.roleCode"), source,
                _lens(obj["codeLens"], source))


def _edge(value: object) -> Edge:
    obj = _object(value, "edge", {"id", "from", "to", "kind", "label", "data",
                                   "condition", "change", "status", "source", "codeLens", "execution"})
    source = _source(obj["source"])
    raw_execution = obj["execution"]
    if not isinstance(raw_execution, dict) or any(not isinstance(key, str) for key in raw_execution):
        raise ValueError("edge.execution: expected scenario-to-step object")
    execution_obj = cast(dict[str, object], raw_execution)
    execution = tuple((ExecutionScenario(_text(key, "scenario", nonempty=True)),
                       ExecutionStep(_positive(step, "execution step")))
                      for key, step in execution_obj.items())
    if list(execution) != sorted(execution, key=lambda pair: pair[0]):
        raise ValueError("edge.execution: noncanonical order")
    return Edge(EdgeId(_text(obj["id"], "edge.id", nonempty=True)),
                NodeId(_text(obj["from"], "edge.from", nonempty=True)),
                NodeId(_text(obj["to"], "edge.to", nonempty=True)),
                _enum(obj["kind"], EdgeKind, "edge.kind"),
                _text(obj["label"], "edge.label", nonempty=True), _text(obj["data"], "edge.data"),
                _enum(obj["condition"], Condition, "edge.condition"), parse_change_tag(obj["change"]),
                _enum(obj["status"], EvidenceStatus, "edge.status"), source,
                _lens(obj["codeLens"], source), execution)


def _scenario_key(scenario: ExecutionScenario) -> int:
    return {"first": 0, "repeat": 1}.get(scenario, 99)


def _source_order(source: SourceLocation | None) -> tuple[str, int]:
    return (str(source.path), source.start_line) if source else ("", 0)


def parse_model_json(text: str) -> ModelDocument:
    """Parse and validate all fields of a canonical mental-model.json document."""
    raw: object = json.loads(text)
    obj = _object(raw, "canonical model", {"schemaVersion", "rendererVersion", "skillVersion",
                                            "locale", "title", "summaryCode", "nodes", "edges", "scenarios"})
    header = ModelHeader(_positive(obj["schemaVersion"], "schemaVersion"),
                         _positive(obj["rendererVersion"], "rendererVersion"),
                         _text(obj["skillVersion"], "skillVersion", nonempty=True),
                         _text(obj["locale"], "locale"))
    if (header.schema_version, header.renderer_version, header.skill_version) != (SCHEMA_VERSION, RENDERER_VERSION, SKILL_VERSION):
        raise ValueError("unsupported canonical model version")
    if header.locale not in ("ja-JP", "en-US"):
        raise ValueError("unsupported locale")
    nodes = tuple(_node(item) for item in _array(obj["nodes"], "nodes"))
    edges = tuple(_edge(item) for item in _array(obj["edges"], "edges"))
    if not nodes:
        raise ValueError("nodes must be nonempty")
    node_ids = {node.id for node in nodes}
    if len(node_ids) != len(nodes) or len({edge.id for edge in edges}) != len(edges):
        raise ValueError("duplicate node or edge ID")
    if any(edge.from_id not in node_ids or edge.to_id not in node_ids for edge in edges):
        raise ValueError("dangling edge endpoint")
    if list(nodes) != sorted(nodes, key=lambda n: (list(Layer).index(n.layer), n.kind.value,
                                                      *_source_order(n.source), n.id)):
        raise ValueError("noncanonical node order")
    order = {node.id: index for index, node in enumerate(nodes)}
    if list(edges) != sorted(edges, key=lambda e: (order[e.from_id], order[e.to_id],
                                                      e.kind.value, *_source_order(e.source), e.id)):
        raise ValueError("noncanonical edge order")
    scenarios = tuple(ExecutionScenario(_text(item, "scenario", nonempty=True))
                      for item in _array(obj["scenarios"], "scenarios"))
    expected = tuple(sorted({name for edge in edges for name, _ in edge.execution},
                            key=lambda name: (_scenario_key(name), name)))
    if scenarios != expected:
        raise ValueError("scenarios do not match edge execution")
    model = MentalModel(_text(obj["title"], "title", nonempty=True),
                        _enum(obj["summaryCode"], SummaryCode, "summaryCode"),
                        nodes, edges, scenarios)
    return ModelDocument(header, model)


def _source_json(source: SourceLocation | None) -> dict[str, object] | None:
    if source is None:
        return None
    return {"path": source.path, "startLine": source.start_line, "endLine": source.end_line}


def _lens_json(lens: CodeLens | None) -> dict[str, object] | None:
    if lens is None:
        return None
    return {"path": lens.path, "startLine": lens.start_line, "endLine": lens.end_line,
            "focusStart": lens.focus_start, "focusEnd": lens.focus_end,
            "lines": [{"number": line.number, "text": line.text} for line in lens.lines]}


def change_tag(change: Change) -> str:
    match change:
        case Existing():
            return "existing"
        case Added():
            return "added"
        case Removed():
            return "removed"
        case Changed():
            return "changed"
        case _:
            assert_never(change)


def serialize_model_json(document: ModelDocument) -> str:
    """Return the canonical UTF-8 JSON text, including its final newline."""
    header, model = document.header, document.model
    value: dict[str, object] = {
        "schemaVersion": header.schema_version, "rendererVersion": header.renderer_version,
        "skillVersion": header.skill_version, "locale": header.locale,
        "title": model.title, "summaryCode": model.summary_code.value,
        "nodes": [{"id": node.id, "label": node.label, "kind": node.kind.value,
                   "layer": node.layer.value, "status": node.status.value,
                   "state": node.state.value, "roleCode": node.role_code.value,
                   "source": _source_json(node.source), "codeLens": _lens_json(node.code_lens)}
                  for node in model.nodes],
        "edges": [{"id": edge.id, "from": edge.from_id, "to": edge.to_id,
                   "kind": edge.kind.value, "label": edge.label, "data": edge.data,
                   "condition": edge.condition.value, "change": change_tag(edge.change),
                   "status": edge.status.value, "source": _source_json(edge.source),
                   "codeLens": _lens_json(edge.code_lens),
                   "execution": {name: step for name, step in edge.execution}}
                  for edge in model.edges],
        "scenarios": list(model.scenarios),
    }
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"

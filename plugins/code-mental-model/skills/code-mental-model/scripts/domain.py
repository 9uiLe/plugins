"""Typed values for a canonical code mental model."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from pathlib import PurePosixPath
from typing import NewType

NodeId = NewType("NodeId", str)
EdgeId = NewType("EdgeId", str)
SourcePath = NewType("SourcePath", str)
LineNumber = NewType("LineNumber", int)
ExecutionStep = NewType("ExecutionStep", int)
ExecutionScenario = NewType("ExecutionScenario", str)


class NodeKind(StrEnum):
    CALLER = "caller"
    UI = "ui"
    CONTROLLER = "controller"
    VIEW_MODEL = "view-model"
    USE_CASE = "use-case"
    SERVICE = "service"
    REPOSITORY = "repository"
    DATA_SOURCE = "data-source"
    STORAGE = "storage"
    EXTERNAL_SYSTEM = "external-system"
    ENTITY = "entity"
    VALUE = "value"
    UNKNOWN = "unknown"


class EdgeKind(StrEnum):
    CALLS = "calls"
    READS = "reads"
    WRITES = "writes"
    RETURNS = "returns"
    CREATES = "creates"
    OWNS = "owns"
    DEPENDS_ON = "depends-on"
    IMPLEMENTS = "implements"
    EMITS = "emits"
    OBSERVES = "observes"
    TRANSFORMS = "transforms"
    PERSISTS = "persists"
    FETCHES = "fetches"
    INJECTS = "injects"
    DELEGATES_TO = "delegates-to"


class EvidenceStatus(StrEnum):
    CONFIRMED = "confirmed"
    INFERRED = "inferred"
    UNKNOWN = "unknown"


class StateKind(StrEnum):
    STATELESS = "stateless"
    OWNED = "owned"
    PERSISTENT = "persistent"
    EXTERNAL = "external"
    TRANSIENT = "transient"
    UNKNOWN = "unknown"


class Layer(StrEnum):
    ENTRY = "entry"
    APPLICATION = "application"
    DATA = "data"
    EXTERNAL = "external"
    VALUE = "value"


class RoleCode(StrEnum):
    ENTRY = "entry"
    COORDINATOR = "coordinator"
    STATE_HOLDER = "state-holder"
    SIDE_EFFECT_BOUNDARY = "side-effect-boundary"
    DATA_VALUE = "data-value"
    UNKNOWN = "unknown"


class Condition(StrEnum):
    ALWAYS = "always"
    ON_HIT = "on-hit"
    ON_MISS = "on-miss"
    UNKNOWN = "unknown"


class SummaryCode(StrEnum):
    UNKNOWN = "unknown"
    CACHED_RESULT_SKIPS_SIDE_EFFECT = "cached-result-skips-side-effect"


@dataclass(frozen=True, slots=True)
class Existing:
    pass


@dataclass(frozen=True, slots=True)
class Added:
    pass


@dataclass(frozen=True, slots=True)
class Removed:
    pass


@dataclass(frozen=True, slots=True)
class Changed:
    pass


Change = Existing | Added | Removed | Changed


@dataclass(frozen=True, slots=True)
class SourceLocation:
    path: SourcePath
    start_line: LineNumber
    end_line: LineNumber

    def __post_init__(self) -> None:
        validate_source_path(self.path)
        if self.start_line < 1 or self.end_line < self.start_line or self.end_line - self.start_line >= 25:
            raise ValueError("invalid source line range")


def validate_source_path(path: SourcePath) -> None:
    value = str(path)
    if (not value or "\\" in value or "\x00" in value or PurePosixPath(value).is_absolute()
            or PurePosixPath(value).as_posix() != value
            or any(part in (".", "..") for part in value.split("/"))):
        raise ValueError(f"invalid repository-relative source path: {value!r}")


@dataclass(frozen=True, slots=True)
class CodeRange:
    path: SourcePath
    start_line: LineNumber
    end_line: LineNumber

    def __post_init__(self) -> None:
        validate_source_path(self.path)
        if self.start_line < 1 or self.end_line < self.start_line:
            raise ValueError("invalid Code Lens display range")


@dataclass(frozen=True, slots=True)
class CodeLine:
    number: LineNumber
    text: str

    def __post_init__(self) -> None:
        if self.number < 1:
            raise ValueError("Code Lens line number must be positive")


@dataclass(frozen=True, slots=True)
class CodeLens:
    display_range: CodeRange
    focus: SourceLocation
    lines: tuple[CodeLine, ...]

    def __post_init__(self) -> None:
        if (self.display_range.path != self.focus.path
                or self.display_range.start_line > self.focus.start_line
                or self.display_range.end_line < self.focus.end_line
                or tuple(line.number for line in self.lines)
                != tuple(range(self.display_range.start_line, self.display_range.end_line + 1))):
            raise ValueError("invalid Code Lens range or lines")

    @property
    def path(self) -> SourcePath:
        return self.display_range.path

    @property
    def start_line(self) -> LineNumber:
        return self.display_range.start_line

    @property
    def end_line(self) -> LineNumber:
        return self.display_range.end_line

    @property
    def focus_start(self) -> LineNumber:
        return self.focus.start_line

    @property
    def focus_end(self) -> LineNumber:
        return self.focus.end_line


@dataclass(frozen=True, slots=True)
class Node:
    id: NodeId
    label: str
    kind: NodeKind
    layer: Layer
    status: EvidenceStatus
    state: StateKind
    role_code: RoleCode
    source: SourceLocation | None
    code_lens: CodeLens | None

    def __post_init__(self) -> None:
        if not self.id or not self.label.strip():
            raise ValueError("node requires an ID and label")
        _validate_lens_source(self.source, self.code_lens)


@dataclass(frozen=True, slots=True)
class Edge:
    id: EdgeId
    from_id: NodeId
    to_id: NodeId
    kind: EdgeKind
    label: str
    data: str
    condition: Condition
    change: Change
    status: EvidenceStatus
    source: SourceLocation | None
    code_lens: CodeLens | None
    execution: tuple[tuple[ExecutionScenario, ExecutionStep], ...]

    def __post_init__(self) -> None:
        if not self.id or not self.from_id or not self.to_id or not self.label.strip():
            raise ValueError("edge requires an ID, endpoints, and label")
        _validate_lens_source(self.source, self.code_lens)
        if any(not scenario or step < 1 for scenario, step in self.execution):
            raise ValueError("execution requires named scenarios and positive steps")
        if len({scenario for scenario, _ in self.execution}) != len(self.execution):
            raise ValueError("duplicate execution scenario")


def _validate_lens_source(source: SourceLocation | None, lens: CodeLens | None) -> None:
    if (source is None) != (lens is None):
        raise ValueError("source and Code Lens must occur together")
    if source is not None and lens is not None and (
        lens.path != source.path or lens.focus_start != source.start_line
        or lens.focus_end != source.end_line
    ):
        raise ValueError("Code Lens does not match source")


@dataclass(frozen=True, slots=True)
class MentalModel:
    title: str
    summary_code: SummaryCode
    nodes: tuple[Node, ...]
    edges: tuple[Edge, ...]
    scenarios: tuple[ExecutionScenario, ...]

    def __post_init__(self) -> None:
        node_ids = {node.id for node in self.nodes}
        edge_ids = {edge.id for edge in self.edges}
        if not self.title.strip() or not self.nodes:
            raise ValueError("mental model requires a title and nodes")
        if len(node_ids) != len(self.nodes) or len(edge_ids) != len(self.edges):
            raise ValueError("duplicate node or edge ID")
        if any(edge.from_id not in node_ids or edge.to_id not in node_ids for edge in self.edges):
            raise ValueError("dangling edge endpoint")
        if len(set(self.scenarios)) != len(self.scenarios):
            raise ValueError("duplicate execution scenario")
        if set(self.scenarios) != {name for edge in self.edges for name, _ in edge.execution}:
            raise ValueError("scenarios do not match edge execution")

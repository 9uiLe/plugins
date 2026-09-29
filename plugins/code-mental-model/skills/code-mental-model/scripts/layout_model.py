"""Immutable geometry produced from a code mental model."""

from __future__ import annotations

from dataclasses import dataclass, replace
from types import MappingProxyType
from typing import ItemsView, Iterator, Mapping

from domain import Change, EdgeId, EdgeKind, ExecutionScenario, ExecutionStep, Layer, NodeId, RoleCode

Point = tuple[int, int]
Size = tuple[int, int]


@dataclass(frozen=True, slots=True)
class Box:
    x0: float
    y0: float
    x1: float
    y1: float

    def intersects(self, other: Box, pad: float = 0) -> bool:
        return (self.x0 < other.x1 + pad and other.x0 < self.x1 + pad
                and self.y0 < other.y1 + pad and other.y0 < self.y1 + pad)


@dataclass(frozen=True, slots=True)
class NodeData:
    id: NodeId
    label: str
    role_code: RoleCode
    layer: Layer


@dataclass(frozen=True, slots=True)
class EdgeData:
    id: EdgeId
    from_: NodeId
    to: NodeId
    kind: EdgeKind
    label: str
    execution: Mapping[ExecutionScenario, ExecutionStep]
    change: Change


@dataclass(frozen=True, slots=True)
class ModelData:
    nodes: tuple[NodeData, ...]
    edges: tuple[EdgeData, ...]


@dataclass(slots=True)
class CandidateLayout:
    candidate: str
    coords: dict[NodeId, Point]
    sizes: dict[NodeId, Size]
    routes: dict[EdgeId, list[Point]]
    labels: dict[EdgeId, tuple[int, int, str, str]]
    width: int
    height: int
    metrics: LayoutMetrics | None = None


@dataclass(frozen=True, slots=True)
class PositionedNode:
    id: NodeId
    center: Point
    size: Size


@dataclass(frozen=True, slots=True)
class EdgeRoute:
    id: EdgeId
    points: tuple[Point, ...]


@dataclass(frozen=True, slots=True)
class LabelPlacement:
    id: EdgeId
    x: int
    y: int
    text: str
    execution: str
    box: Box
    anchor: Point
    attachment: Point
    show_leader: bool


@dataclass(frozen=True, slots=True)
class LayoutConfig:
    name: str = "a-balanced"
    sibling_gap: int = 136
    layer_gap: int = 168
    reverse_siblings: bool = False
    lane_scale: int = 24
    orthogonal_cross_layer: bool = False
    route_below_intermediate_nodes: bool = False
    obstacle_clearance: int = 16
    mobile: bool = False
    node_min_width: tuple[int, int] = (184, 112)
    node_char_width: tuple[int, int] = (10, 9)
    node_padding: tuple[int, int] = (36, 32)
    coordinator_extra_width: tuple[int, int] = (20, 24)
    node_height: int = 70
    coordinator_height: int = 76
    lane_spacing: int = 24
    port_padding: int = 32
    min_canvas_width: tuple[int, int] = (450, 260)
    canvas_side_padding: tuple[int, int] = (120, 64)
    canvas_vertical_padding: int = 80
    route_direct_threshold: int = 48
    min_node_gap: int = 72
    label_clearance: int = 16
    label_boundary_margin: int = 12
    label_segment_clearance: int = 3
    label_min_width: int = 24
    label_char_width: int = 7
    label_width_padding: int = 10
    short_label_argument_limit: int = 12
    label_top: int = 14
    label_bottom: int = 4
    label_offsets: tuple[int, ...] = (0, 12, -12, 18, -18, 36, -36, 54, -54, 72, -72, 90, -90)
    label_along: tuple[int, ...] = (0, -24, 24, -48, 48, -72, 72, -96, 96)
    label_fallback_offset: int = 18
    leader_threshold: int = 18
    parallel_angle_tolerance: float = .025
    parallel_distance: int = 12
    parallel_overlap: int = 20
    collinear_overlap_margin: int = 2
    crossing_lower_bound: float = .001
    crossing_upper_bound: float = .999
    execution_priority_fallback: int = 999
    imbalance_aspect_weight: float = .1
    cost_weights: tuple[tuple[str, float], ...] = (
        ("crossings", 1000), ("labelConnectorCrossings", 1000), ("edgeOverlaps", 800), ("labelCollisions", 500),
        ("edgeLabelCollisions", 500), ("nodeLabelCollisions", 500),
        ("nodeEdgeCollisions", 500), ("reciprocalAmbiguity", 300),
        ("bends", 20), ("labelConnectorLength", 2), ("edgeLength", .1), ("imbalance", 1),
    )

    def for_mobile(self, values: tuple[int, int]) -> int:
        return values[1] if self.mobile else values[0]

    @classmethod
    def candidates(cls, mobile: bool) -> tuple[LayoutConfig, ...]:
        base = cls(mobile=mobile, sibling_gap=72 if mobile else 136,
                   layer_gap=144 if mobile else 168)
        if mobile:
            return (base, replace(base, name="b-reversed", reverse_siblings=True),
                    replace(base, name="c-tall", layer_gap=base.layer_gap + 80),
                    replace(base, name="d-tall-reversed", layer_gap=base.layer_gap + 80, reverse_siblings=True),
                    replace(base, name="e-taller", layer_gap=base.layer_gap + 128),
                    replace(base, name="f-taller-reversed", layer_gap=base.layer_gap + 128, reverse_siblings=True),
                    replace(base, name="g-compact-orthogonal", layer_gap=112, lane_scale=36,
                            orthogonal_cross_layer=True),
                    replace(base, name="h-compact-orthogonal-reversed", layer_gap=112, lane_scale=36,
                            reverse_siblings=True, orthogonal_cross_layer=True),
                    replace(base, name="i-clearance", sibling_gap=base.min_node_gap + base.lane_spacing,
                            route_below_intermediate_nodes=True),
                    replace(base, name="j-clearance-reversed", sibling_gap=base.min_node_gap + base.lane_spacing,
                            route_below_intermediate_nodes=True,
                            reverse_siblings=True))
        return (base,
                replace(base, name="b-wide", sibling_gap=base.sibling_gap + 56, layer_gap=base.layer_gap + 32),
                replace(base, name="c-reversed", sibling_gap=base.sibling_gap + 32, layer_gap=base.layer_gap + 16, reverse_siblings=True),
                replace(base, name="d-expanded", sibling_gap=base.sibling_gap + 72, layer_gap=base.layer_gap + 72, lane_scale=36),
                replace(base, name="e-expanded-reversed", sibling_gap=base.sibling_gap + 72, layer_gap=base.layer_gap + 72, lane_scale=36, reverse_siblings=True),
                replace(base, name="f-compact-wide", sibling_gap=base.sibling_gap + 88, layer_gap=90),
                replace(base, name="g-compact-orthogonal", sibling_gap=190, layer_gap=110,
                        lane_scale=36, orthogonal_cross_layer=True),
                replace(base, name="h-wide-orthogonal", sibling_gap=220, layer_gap=112,
                        lane_scale=36, orthogonal_cross_layer=True),
                replace(base, name="i-clearance", route_below_intermediate_nodes=True),
                replace(base, name="j-clearance-reversed", route_below_intermediate_nodes=True,
                        reverse_siblings=True))


@dataclass(frozen=True, slots=True)
class LayoutMetrics(Mapping[str, float]):
    crossings: float
    labelConnectorCrossings: float
    edgeOverlaps: float
    labelCollisions: float
    edgeLabelCollisions: float
    nodeLabelCollisions: float
    nodeEdgeCollisions: float
    reciprocalAmbiguity: float
    bends: float
    labelConnectorLength: float
    edgeLength: float
    imbalance: float
    nodeOverlaps: float
    unlabeledImportantEdges: float
    outOfBounds: float
    maxParallelEdges: float
    minParallelEdgeSpacing: float
    cost: float

    @property
    def _as_mapping(self) -> Mapping[str, float]:
        return MappingProxyType({name: getattr(self, name) for name in self.__dataclass_fields__})

    def __getitem__(self, key: str) -> float:
        return self._as_mapping[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._as_mapping)

    def __len__(self) -> int:
        return len(self._as_mapping)

    def items(self) -> ItemsView[str, float]:
        return self._as_mapping.items()


@dataclass(frozen=True, slots=True)
class GraphLayout:
    candidate: str
    nodes: tuple[PositionedNode, ...]
    edge_routes: tuple[EdgeRoute, ...]
    edge_labels: tuple[LabelPlacement, ...]
    width: int
    height: int
    metrics: LayoutMetrics

    @property
    def coords(self) -> Mapping[NodeId, Point]:
        return MappingProxyType({node.id: node.center for node in self.nodes})

    @property
    def sizes(self) -> Mapping[NodeId, Size]:
        return MappingProxyType({node.id: node.size for node in self.nodes})

    @property
    def routes(self) -> Mapping[EdgeId, tuple[Point, ...]]:
        return MappingProxyType({route.id: route.points for route in self.edge_routes})

    @property
    def labels(self) -> Mapping[EdgeId, LabelPlacement]:
        return MappingProxyType({label.id: label for label in self.edge_labels})

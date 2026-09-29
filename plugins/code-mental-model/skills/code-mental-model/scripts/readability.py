"""Geometry intersection and readability scoring for graph layouts."""

from __future__ import annotations

from collections import defaultdict
from math import hypot

from domain import NodeId
from layout_model import Box, CandidateLayout, EdgeData, LayoutConfig, LayoutMetrics, ModelData, Point

DEFAULT_CONFIG = LayoutConfig()


def _pair(first: NodeId, second: NodeId) -> tuple[NodeId, NodeId]:
    return (first, second) if first <= second else (second, first)

def label_box(x: int, y: int, label: str, execution: str = "", config: LayoutConfig = DEFAULT_CONFIG) -> Box:
    width = max(config.label_min_width, max(len(label), len(execution)) * config.label_char_width + config.label_width_padding)
    return Box(x - width / 2, y - config.label_top, x + width / 2, y + config.label_bottom)


def label_connection(point: Point, route: list[Point] | tuple[Point, ...], box: Box) -> tuple[Point, Point]:
    """Connect a label boundary to the nearest point on its own edge."""
    candidates: list[tuple[float, int, Point]] = []
    for index, (start, end) in enumerate(zip(route, route[1:])):
        dx, dy = end[0] - start[0], end[1] - start[1]
        length_squared = dx * dx + dy * dy
        fraction = (max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy)
                                   / length_squared)) if length_squared else 0.0)
        projected = (round(start[0] + fraction * dx), round(start[1] + fraction * dy))
        candidates.append((hypot(point[0] - projected[0], point[1] - projected[1]), index, projected))
    if not candidates:
        raise ValueError("edge route has no segment")
    anchor = min(candidates)[2]
    attachment = (round(max(box.x0, min(box.x1, anchor[0]))),
                  round(max(box.y0, min(box.y1, anchor[1]))))
    return anchor, attachment


def segments(points: list[tuple[int, int]]) -> list[tuple[tuple[int, int], tuple[int, int]]]:
    return [(a, b) for a, b in zip(points, points[1:]) if a != b]


def segment_box(a: tuple[int, int], b: tuple[int, int]) -> Box:
    return Box(min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]) + 1, max(a[1], b[1]) + 1)


def segment_relation(a: tuple[tuple[float, float], tuple[float, float]], b: tuple[tuple[float, float], tuple[float, float]], config: LayoutConfig = DEFAULT_CONFIG) -> tuple[int, int]:
    (x1, y1), (x2, y2) = a
    (u1, v1), (u2, v2) = b
    dx, dy, ex, ey = x2 - x1, y2 - y1, u2 - u1, v2 - v1
    length_a, length_b = hypot(dx, dy), hypot(ex, ey)
    def near_parallel() -> bool:
        if not length_a or not length_b or abs(dx * ey - dy * ex) > config.parallel_angle_tolerance * length_a * length_b:
            return False
        distance = max(abs((u1 - x1) * dy - (v1 - y1) * dx),
                       abs((u2 - x1) * dy - (v2 - y1) * dx)) / length_a
        projections = sorted(((u1 - x1) * dx / length_a + (v1 - y1) * dy / length_a,
                              (u2 - x1) * dx / length_a + (v2 - y1) * dy / length_a))
        return distance < config.parallel_distance and min(length_a, projections[1]) - max(0, projections[0]) > config.parallel_overlap
    if x1 != x2 and y1 != y2 or u1 != u2 and v1 != v2:
        def cross(x: float, y: float, u: float, v: float) -> float:
            return x * v - y * u
        denominator = cross(dx, dy, ex, ey)
        rx, ry = u1 - x1, v1 - y1
        if denominator == 0:
            overlap = cross(rx, ry, dx, dy) == 0 and max(min(x1, x2), min(u1, u2)) < min(max(x1, x2), max(u1, u2)) - config.collinear_overlap_margin and max(min(y1, y2), min(v1, v2)) < min(max(y1, y2), max(v1, v2)) - config.collinear_overlap_margin
            return 0, int(overlap)
        t, s = cross(rx, ry, ex, ey) / denominator, cross(rx, ry, dx, dy) / denominator
        crossing = int(config.crossing_lower_bound < t < config.crossing_upper_bound and config.crossing_lower_bound < s < config.crossing_upper_bound)
        return crossing, int(not crossing and near_parallel())
    av, bv = x1 == x2, u1 == u2
    if av == bv:
        return 0, int(near_parallel())
    vertical, horizontal = (a, b) if av else (b, a)
    vx, hy = vertical[0][0], horizontal[0][1]
    if min(vertical[0][1], vertical[1][1]) < hy < max(vertical[0][1], vertical[1][1]) and min(horizontal[0][0], horizontal[1][0]) < vx < max(horizontal[0][0], horizontal[1][0]):
        return 1, 0
    return 0, 0


def segment_hits_box(a: tuple[int, int], b: tuple[int, int], box: Box, pad: int = 0, config: LayoutConfig = DEFAULT_CONFIG) -> bool:
    expanded = Box(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad)
    if not segment_box(a, b).intersects(expanded):
        return False
    if expanded.x0 <= a[0] <= expanded.x1 and expanded.y0 <= a[1] <= expanded.y1:
        return True
    if expanded.x0 <= b[0] <= expanded.x1 and expanded.y0 <= b[1] <= expanded.y1:
        return True
    corners = ((expanded.x0, expanded.y0), (expanded.x1, expanded.y0),
               (expanded.x1, expanded.y1), (expanded.x0, expanded.y1))
    return any(segment_relation((a, b), (corners[i], corners[(i + 1) % 4]), config)[0] for i in range(4))


def measure(model: ModelData, layout: CandidateLayout, config: LayoutConfig) -> LayoutMetrics:
    nodes = {ident: Box(x - layout.sizes[ident][0] / 2, y - layout.sizes[ident][1] / 2,
                        x + layout.sizes[ident][0] / 2, y + layout.sizes[ident][1] / 2)
             for ident, (x, y) in layout.coords.items()}
    labels = {ident: label_box(*item, config=config) for ident, item in layout.labels.items()}
    edges = {e.id: e for e in model.edges}
    metrics: dict[str, float] = dict.fromkeys((*(key for key, _ in config.cost_weights), "nodeOverlaps", "unlabeledImportantEdges", "outOfBounds"), 0)
    metrics["nodeOverlaps"] = sum(a.intersects(b, config.min_node_gap) for i, a in enumerate(nodes.values()) for b in list(nodes.values())[i + 1:])
    metrics["nodeLabelCollisions"] = sum(box.intersects(node, config.label_clearance) for box in labels.values() for node in nodes.values())
    metrics["labelCollisions"] = sum(a.intersects(b, config.label_clearance) for i, a in enumerate(labels.values()) for b in list(labels.values())[i + 1:])
    metrics["unlabeledImportantEdges"] = sum(edge.id not in labels for edge in model.edges)
    metrics["labelConnectorLength"] = round(sum(
        hypot(anchor[0] - attachment[0], anchor[1] - attachment[1])
        for ident, (x, y, _, _) in layout.labels.items()
        for anchor, attachment in (label_connection((x, y), layout.routes[ident], labels[ident]),)
    ), 1)
    metrics["labelConnectorCrossings"] = sum(
        crossing + overlap
        for ident, (x, y, _, _) in layout.labels.items()
        for anchor, attachment in (label_connection((x, y), layout.routes[ident], labels[ident]),)
        if anchor != attachment
        for other_id, points in layout.routes.items() if other_id != ident
        for start, end in segments(points)
        for crossing, overlap in (segment_relation((attachment, anchor), (start, end), config),)
    )
    metrics["outOfBounds"] = sum(box.x0 < 0 or box.y0 < 0 or box.x1 > layout.width or box.y1 > layout.height for box in labels.values())
    pairs: dict[tuple[NodeId, NodeId], list[EdgeData]] = defaultdict(list)
    for edge in model.edges:
        pairs[_pair(edge.from_, edge.to)].append(edge)
    metrics["maxParallelEdges"] = max((len(group) for group in pairs.values()), default=0)
    spacings = []
    for group in pairs.values():
        for i, first in enumerate(group):
            for second in group[i + 1:]:
                for node_id in (first.from_, first.to):
                    a = layout.routes[first.id][0 if first.from_ == node_id else -1]
                    b = layout.routes[second.id][0 if second.from_ == node_id else -1]
                    spacings.append(hypot(a[0] - b[0], a[1] - b[1]))
    metrics["minParallelEdgeSpacing"] = min(spacings, default=0)
    for edge in model.edges:
        route = layout.routes[edge.id]
        metrics["bends"] += sum(a[0] != b[0] and b[1] != c[1] or a[1] != b[1] and b[0] != c[0]
                                for a, b, c in zip(route, route[1:], route[2:]))
        metrics["edgeLength"] += sum(hypot(a[0] - b[0], a[1] - b[1]) for a, b in segments(route))
        for other_id, box in labels.items():
            if other_id != edge.id:
                metrics["edgeLabelCollisions"] += any(segment_hits_box(a, b, box, config.label_segment_clearance, config) for a, b in segments(route))
        for node_id, box in nodes.items():
            if node_id not in (edge.from_, edge.to):
                metrics["nodeEdgeCollisions"] += any(segment_hits_box(a, b, box, config.label_segment_clearance, config) for a, b in segments(route))
    ids = list(layout.routes)
    for i, ident in enumerate(ids):
        for other in ids[i + 1:]:
            same_pair = {edges[ident].from_, edges[ident].to} == {edges[other].from_, edges[other].to}
            for first_segment in segments(layout.routes[ident]):
                for second_segment in segments(layout.routes[other]):
                    crossing, overlap = segment_relation(first_segment, second_segment, config)
                    metrics["crossings"] += crossing
                    metrics["edgeOverlaps"] += overlap
                    if same_pair and overlap:
                        metrics["reciprocalAmbiguity"] += 1
    centers = [x for x, _ in layout.coords.values()]
    metrics["imbalance"] = round((abs((min(centers) + max(centers)) / 2 - layout.width / 2) if centers else 0)
                                 + abs(layout.width - layout.height) * config.imbalance_aspect_weight, 1)
    metrics["edgeLength"] = round(metrics["edgeLength"], 1)
    metrics["cost"] = round(sum(metrics[key] * weight for key, weight in config.cost_weights), 1)
    return LayoutMetrics(**metrics)

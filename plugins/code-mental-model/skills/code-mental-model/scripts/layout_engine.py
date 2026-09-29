"""Pure deterministic layout of a typed mental model."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from math import hypot
from types import MappingProxyType
from typing import assert_never

from domain import Added, Changed, Change, Edge, EdgeId, EdgeKind, Existing, Layer, MentalModel, Node, NodeId, Removed, RoleCode
from layout_model import Box, CandidateLayout, EdgeData, EdgeRoute, GraphLayout, LabelPlacement, LayoutConfig, LayoutMetrics, ModelData, NodeData, PositionedNode
from readability import label_box, label_connection, measure, segment_hits_box, segment_relation, segments


def _node_data(node: Node) -> NodeData:
    return NodeData(node.id, node.label, node.role_code, node.layer)


def _edge_data(edge: Edge) -> EdgeData:
    return EdgeData(edge.id, edge.from_id, edge.to_id, edge.kind, edge.label,
                    MappingProxyType(dict(edge.execution)),
                    edge.change)


def _change_marker(change: Change) -> str:
    match change:
        case Added():
            return "+ "
        case Removed():
            return "− "
        case Changed():
            return "Δ "
        case Existing():
            return ""
        case other:
            assert_never(other)


def _model_data(model: MentalModel) -> ModelData:
    return ModelData(tuple(_node_data(node) for node in model.nodes),
                     tuple(_edge_data(edge) for edge in model.edges))


def _pair(first: NodeId, second: NodeId) -> tuple[NodeId, NodeId]:
    return (first, second) if first <= second else (second, first)


ROLE_LAYER = {RoleCode.ENTRY: 0, RoleCode.COORDINATOR: 1, RoleCode.STATE_HOLDER: 2,
              RoleCode.SIDE_EFFECT_BOUNDARY: 2, RoleCode.DATA_VALUE: 3}
FALLBACK_LAYER = {Layer.ENTRY: 0, Layer.APPLICATION: 1, Layer.DATA: 2,
                  Layer.EXTERNAL: 2, Layer.VALUE: 3}


def edge_kind_order(kind: EdgeKind) -> int:
    match kind:
        case EdgeKind.CALLS: return 0
        case EdgeKind.READS: return 1
        case EdgeKind.FETCHES: return 2
        case EdgeKind.RETURNS: return 3
        case EdgeKind.CREATES: return 4
        case EdgeKind.WRITES: return 5
        case EdgeKind.PERSISTS: return 6
        case EdgeKind.EMITS: return 7
        case EdgeKind.OBSERVES: return 8
        case EdgeKind.DEPENDS_ON: return 9
        case EdgeKind.OWNS: return 10
        case EdgeKind.IMPLEMENTS: return 11
        case EdgeKind.TRANSFORMS: return 12
        case EdgeKind.INJECTS: return 13
        case EdgeKind.DELEGATES_TO: return 14
        case other: assert_never(other)

def short_label(label: str, mobile: bool = False, kind: EdgeKind | None = None, config: LayoutConfig = LayoutConfig()) -> str:
    if "(" in label and label.endswith(")"):
        name, arguments = label.split("(", 1)
        args = arguments[:-1].strip()
        if not args:
            result = name
        elif "," in args:
            result = name + "(…)"
        elif len(args) <= config.short_label_argument_limit:
            result = label
        else:
            result = name + "(…)"
    else:
        result = label
    if mobile:
        if kind == EdgeKind.CREATES:
            return "Create"
        if kind == EdgeKind.RETURNS and result in ("Receipt", "Receipt?"):
            return "Return?" if result.endswith("?") else "Return"
        if "(" in result:
            result = result.split("(", 1)[0]
            result = result[:1].upper() + result[1:]
    return result


def node_size(node: NodeData, config: LayoutConfig) -> tuple[int, int]:
    width = max(config.for_mobile(config.node_min_width), len(node.label) * config.for_mobile(config.node_char_width) + config.for_mobile(config.node_padding))
    if node.role_code == RoleCode.COORDINATOR:
        width += config.for_mobile(config.coordinator_extra_width)
    return width, config.coordinator_height if node.role_code == RoleCode.COORDINATOR else config.node_height


def layer_number(node: NodeData) -> int:
    return ROLE_LAYER.get(node.role_code, FALLBACK_LAYER[node.layer])


def ordered_layers(model: ModelData, reverse_siblings: bool) -> list[list[NodeData]]:
    groups: dict[int, list[NodeData]] = defaultdict(list)
    degree: dict[str, int] = defaultdict(int)
    for edge in model.edges:
        degree[edge.from_] += 1
        degree[edge.to] += 1
    for node in model.nodes:
        groups[layer_number(node)].append(node)
    layers = []
    for index in sorted(groups):
        nodes = groups[index]
        nodes.sort(key=lambda n: (0 if n.role_code == RoleCode.STATE_HOLDER else 1, n.id))
        if index == 1 and len(nodes) > 1:
            center_first = sorted(range(len(nodes)), key=lambda i: (abs(i - (len(nodes) - 1) / 2), i))
            by_priority = sorted(nodes, key=lambda n: (n.role_code != RoleCode.COORDINATOR, -degree[n.id], n.id))
            arranged: list[NodeData | None] = [None] * len(nodes)
            for slot, node in zip(center_first, by_priority):
                arranged[slot] = node
            nodes = [node for node in arranged if node is not None]
        if reverse_siblings:
            nodes.reverse()
        layers.append(nodes)
    return layers


def label_position(edge_id: EdgeId, route: list[tuple[int, int]], text: str, execution: str, nodes: dict[NodeId, Box], placed: dict[EdgeId, tuple[int, int, str, str]], routes: dict[EdgeId, list[tuple[int, int]]], width: int, height: int, config: LayoutConfig) -> tuple[int, int, str, str]:
    parts = sorted(segments(route), key=lambda part: -(abs(part[0][0] - part[1][0]) + abs(part[0][1] - part[1][1])))
    best: tuple[tuple[int, float, int, int, int, int], tuple[int, int, str, str]] | None = None
    for a, b in parts:
        cx, cy = (a[0] + b[0]) // 2, (a[1] + b[1]) // 2
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = max(1, hypot(dx, dy))
        for offset in config.label_offsets:
            for along in config.label_along:
                x = round(cx + along * dx / length - offset * dy / length)
                y = round(cy + along * dy / length + offset * dx / length)
                box = label_box(x, y, text, execution, config)
                if box.x0 < config.label_boundary_margin or box.x1 > width - config.label_boundary_margin or box.y0 < config.label_boundary_margin or box.y1 > height - config.label_boundary_margin:
                    continue
                if any(box.intersects(node, config.label_clearance) for node in nodes.values()):
                    continue
                if any(box.intersects(label_box(*other, config=config), config.label_clearance) for other in placed.values()):
                    continue
                if any(segment_hits_box(p, q, box, config.label_segment_clearance, config) for ident, points in routes.items() if ident != edge_id for p, q in segments(points)):
                    continue
                anchor, attachment = label_connection((x, y), route, box)
                connector = hypot(anchor[0] - attachment[0], anchor[1] - attachment[1])
                crossings = (sum(crossing + overlap
                                 for ident, points in routes.items() if ident != edge_id
                                 for p, q in segments(points)
                                 for crossing, overlap in (segment_relation((attachment, anchor), (p, q), config),))
                             if connector else 0)
                score = (crossings, round(connector, 1), abs(offset), abs(along), x, y)
                if best is None or score < best[0]:
                    best = score, (x, y, text, execution)
    if best is not None:
        return best[1]
    a, b = parts[0]
    return (a[0] + b[0]) // 2, (a[1] + b[1]) // 2 - config.label_fallback_offset, text, execution


def route_edges(model: ModelData, coords: dict[NodeId, tuple[int, int]], sizes: dict[NodeId, tuple[int, int]], config: LayoutConfig) -> dict[EdgeId, list[tuple[int, int]]]:
    groups: dict[tuple[NodeId, NodeId], list[EdgeData]] = defaultdict(list)
    for edge in model.edges:
        groups[_pair(edge.from_, edge.to)].append(edge)
    rank = {}
    middle_rank = {}
    for pair, group in groups.items():
        group.sort(key=lambda e: (edge_kind_order(e.kind), min(e.execution.values(), default=config.execution_priority_fallback), e.id))
        reverse_lanes = (config.orthogonal_cross_layer and len(group) > 1
                         and coords[group[0].from_][0] < coords[group[0].to][0]
                         and any(item.from_ == group[0].to for item in group[1:]))
        for i, edge in enumerate(group):
            rank[edge.id] = (i, len(group))
            middle_rank[edge.id] = (len(group) - 1 - i if reverse_lanes else i, len(group))
    ports: dict[tuple[NodeId, str], list[EdgeData]] = defaultdict(list)
    for edge in model.edges:
        source, target = edge.from_, edge.to
        sx, sy = coords[source]
        tx, ty = coords[target]
        side_out = "south" if sy < ty else "north" if sy > ty else "east" if sx < tx else "west"
        side_in = "north" if sy < ty else "south" if sy > ty else "west" if sx < tx else "east"
        ports[(source, side_out)].append(edge)
        ports[(target, side_in)].append(edge)
    port_number = {}
    for key, items in ports.items():
        items.sort(key=lambda e: (coords[e.to if e.from_ == key[0] else e.from_][0], rank[e.id][0], e.id))
        for i, edge in enumerate(items):
            port_number[(edge.id, key[0], key[1])] = round((i - (len(items) - 1) / 2) * config.lane_spacing)
    routes: dict[EdgeId, list[tuple[int, int]]] = {}
    for edge in sorted(model.edges, key=lambda item: (abs(coords[item.from_][1] - coords[item.to][1]), item.id)):
        source, target = edge.from_, edge.to
        sx, sy = coords[source]
        tx, ty = coords[target]
        sw, sh = sizes[source]
        tw, th = sizes[target]
        lane_index, lane_count = middle_rank[edge.id]
        lane = round((lane_index - (lane_count - 1) / 2) * config.lane_scale)
        if sy != ty:
            out_side, in_side, sign = ("south", "north", 1) if sy < ty else ("north", "south", -1)
            x1 = sx + port_number[(edge.id, source, out_side)]
            x2 = tx + port_number[(edge.id, target, in_side)]
            y1, y2 = sy + sign * sh // 2, ty - sign * th // 2
            middle = round((y1 + y2) / 2 + lane)
            if sign > 0 and config.route_below_intermediate_nodes:
                obstacles = [(other_x - sizes[other][0] / 2, other_y - sizes[other][1] / 2,
                              other_x + sizes[other][0] / 2, other_y + sizes[other][1] / 2)
                             for other, (other_x, other_y) in coords.items()
                             if other not in (source, target) and y1 < other_y < y2]
                if obstacles:
                    clearance = config.obstacle_clearance
                    departure = min(y1 + clearance, round(min(top for _, top, _, _ in obstacles) - clearance))
                    clear_y = round(max(bottom for _, _, _, bottom in obstacles) + clearance + abs(lane) + lane)
                    direction = -1 if tx < sx else 1 if tx > sx else 0
                    preferred = x1 + direction * config.lane_spacing
                    canvas_margin = config.for_mobile(config.canvas_side_padding) / 2
                    left_bound = min(x - sizes[ident][0] / 2 for ident, (x, _) in coords.items()) - canvas_margin
                    right_bound = max(x + sizes[ident][0] / 2 for ident, (x, _) in coords.items()) + canvas_margin
                    possible_corridors = ([x1 + shift * config.lane_spacing
                                           for shift in range(-len(model.edges), len(model.edges) + 1)]
                                          + [round(boundary) for left, _, right, _ in obstacles
                                             for boundary in (left - clearance, right + clearance)])
                    corridors = [x for x in possible_corridors if all(
                        not left - clearance < x < right + clearance
                        for left, _, right, _ in obstacles) and left_bound <= x <= right_bound]
                    if y1 < departure < clear_y < y2 - clearance and corridors:
                        def proposed(x: int) -> list[tuple[int, int]]:
                            return [(x1, y1), (x1, departure), (x, departure),
                                    (x, clear_y), (x2, clear_y), (x2, y2)]

                        def corridor_score(x: int) -> tuple[int, int, int, int, int, int]:
                            candidate_segments = segments(proposed(x))
                            relations = [segment_relation(a, b, config)
                                         for a in candidate_segments for route in routes.values()
                                         for b in segments(route)]
                            near_lanes = sum(
                                a[0][0] == a[1][0] and b[0][0] == b[1][0]
                                and abs(a[0][0] - b[0][0]) < config.lane_spacing
                                and min(max(a[0][1], a[1][1]), max(b[0][1], b[1][1]))
                                - max(min(a[0][1], a[1][1]), min(b[0][1], b[1][1])) > config.parallel_overlap
                                for a in candidate_segments for route in routes.values() for b in segments(route))
                            return (sum(overlap for _, overlap in relations),
                                    sum(crossing for crossing, _ in relations), near_lanes,
                                    abs(x - preferred), abs(x - x1), x)

                        corridor = min(corridors, key=corridor_score)
                        routes[edge.id] = proposed(corridor)
                        continue
            routes[edge.id] = ([(x1, y1), (x1, middle), (x2, middle), (x2, y2)]
                               if config.orthogonal_cross_layer or config.route_below_intermediate_nodes
                               or abs(sx - tx) <= config.route_direct_threshold
                               else [(x1, y1), (x2, y2)])
        else:
            sign = 1 if sx < tx else -1
            out_side, in_side = ("east", "west") if sign == 1 else ("west", "east")
            y1 = sy + port_number[(edge.id, source, out_side)]
            y2 = ty + port_number[(edge.id, target, in_side)]
            x1, x2 = sx + sign * sw // 2, tx - sign * tw // 2
            middle = round((x1 + x2) / 2 + lane)
            routes[edge.id] = [(x1, y1), (middle, y1), (middle, y2), (x2, y2)]
    return routes


def place_labels(model: ModelData, mobile: bool, coords: dict[NodeId, tuple[int, int]], sizes: dict[NodeId, tuple[int, int]], routes: dict[EdgeId, list[tuple[int, int]]], width: int, height: int, config: LayoutConfig) -> dict[EdgeId, tuple[int, int, str, str]]:
    node_boxes = {ident: Box(x - sizes[ident][0] / 2, y - sizes[ident][1] / 2,
                             x + sizes[ident][0] / 2, y + sizes[ident][1] / 2) for ident, (x, y) in coords.items()}
    labels: dict[EdgeId, tuple[int, int, str, str]] = {}
    for edge in sorted(model.edges, key=lambda e: (0 if not isinstance(e.change, Existing) else 1, e.id)):
        operation = short_label(edge.label, mobile, edge.kind, config)
        text = operation
        text = _change_marker(edge.change) + text
        execution = str(max(edge.execution.values())) if edge.execution else ""
        labels[edge.id] = label_position(edge.id, routes[edge.id], text, execution, node_boxes, labels, routes, width, height, config)
    return labels


def _make_candidate(model: ModelData, config: LayoutConfig) -> CandidateLayout:
    layers = ordered_layers(model, config.reverse_siblings)
    sizes = {n.id: node_size(n, config) for n in model.nodes}
    levels = {node.id: layer_number(node) for node in model.nodes}
    side_counts: dict[tuple[str, str], int] = defaultdict(int)
    for edge in model.edges:
        source, target = edge.from_, edge.to
        if levels[source] != levels[target]:
            side_counts[(source, "south" if levels[source] < levels[target] else "north")] += 1
            side_counts[(target, "north" if levels[source] < levels[target] else "south")] += 1
        else:
            side_counts[(source, "horizontal")] += 1
            side_counts[(target, "horizontal")] += 1
    for node in model.nodes:
        ident = node.id
        width, height = sizes[ident]
        width = max(width, max((side_counts[(ident, side)] - 1) * config.lane_spacing + config.port_padding for side in ("north", "south")))
        height = max(height, (side_counts[(ident, "horizontal")] - 1) * config.lane_spacing + config.port_padding)
        sizes[ident] = width, height
    row_widths = [sum(sizes[n.id][0] for n in row) + config.sibling_gap * (len(row) - 1) for row in layers]
    width = int(max(*(row_widths or [0]), config.for_mobile(config.min_canvas_width)) + (config.for_mobile(config.canvas_side_padding)))
    coords = {}
    y = config.canvas_vertical_padding
    for row in layers:
        row_height = max(sizes[n.id][1] for n in row)
        x = (width - (sum(sizes[n.id][0] for n in row) + config.sibling_gap * (len(row) - 1))) / 2
        for node in row:
            w, h = sizes[node.id]
            coords[node.id] = (round(x + w / 2), y + row_height // 2)
            x += w + config.sibling_gap
        y += row_height + config.layer_gap
    height = y - config.layer_gap + config.canvas_vertical_padding
    routes = route_edges(model, coords, sizes, config)
    labels = place_labels(model, config.mobile, coords, sizes, routes, width, height, config)
    layout = CandidateLayout(config.name, coords, sizes, routes, labels, width, height)
    layout.metrics = measure(model, layout, config)
    return layout


def _metrics(layout: CandidateLayout) -> LayoutMetrics:
    if layout.metrics is None:
        raise ValueError("candidate has not been evaluated")
    return layout.metrics


def _to_graph_layout(model: MentalModel, result: CandidateLayout, config: LayoutConfig) -> GraphLayout:
    placed_labels: list[LabelPlacement] = []
    for edge in model.edges:
        x, y, text, execution = result.labels[edge.id]
        box = label_box(x, y, text, execution, config)
        anchor, attachment = label_connection((x, y), result.routes[edge.id], box)
        show_leader = hypot(anchor[0] - attachment[0], anchor[1] - attachment[1]) > config.leader_threshold
        placed_labels.append(LabelPlacement(edge.id, x, y, text, execution, box, anchor, attachment, show_leader))
    return GraphLayout(
        candidate=result.candidate,
        nodes=tuple(PositionedNode(node.id, result.coords[node.id], result.sizes[node.id]) for node in model.nodes),
        edge_routes=tuple(EdgeRoute(edge.id, tuple(result.routes[edge.id])) for edge in model.edges),
        edge_labels=tuple(placed_labels),
        width=result.width,
        height=result.height,
        metrics=_metrics(result),
    )


def best_layout(model: MentalModel, mobile: bool = False) -> GraphLayout:
    data = _model_data(model)
    candidates = [(config, _make_candidate(data, config)) for config in LayoutConfig.candidates(mobile)]
    valid = [(config, item) for config, item in candidates if not any(_metrics(item)[key] for key in
             ("nodeOverlaps", "nodeLabelCollisions", "labelCollisions", "edgeLabelCollisions", "nodeEdgeCollisions", "edgeOverlaps", "unlabeledImportantEdges", "outOfBounds"))]
    if not valid:
        details = ", ".join(f"{item.candidate}: {item.metrics}" for _, item in candidates)
        raise ValueError(f"no collision-free graph layout: {details}")
    config, result = min(valid, key=lambda pair: (_metrics(pair[1])["cost"], pair[1].candidate))
    return _to_graph_layout(model, result, config)


def make_candidate(model: MentalModel, mobile: bool, config: LayoutConfig) -> GraphLayout:
    selected = replace(config, mobile=mobile)
    result = _make_candidate(_model_data(model), selected)
    return _to_graph_layout(model, result, selected)

"""Deterministic layered SVG layout for small architecture graphs.

Text is measured in approximate CSS pixels using East Asian display width. The
renderer owns all coordinates; callers supply semantic nodes and labelled edges.
"""

from dataclasses import dataclass
import re
import unicodedata


def text_width(value):
    return sum(14 if unicodedata.east_asian_width(char) in "WF" else 7.5 for char in value)


def wrap_label(value, max_width=204):
    """Wrap Japanese text and identifiers without clipping either script."""
    tokens = re.findall(r"[A-Za-z0-9_./:#-]+|\s+|.", str(value))
    lines = []
    current = ""
    for token in tokens:
        if token.isspace():
            if current and not current.endswith(" "):
                current += " "
            continue
        pieces = [token]
        if text_width(token) > max_width:
            pieces = []
            chunk = ""
            for char in token:
                if chunk and text_width(chunk + char) > max_width:
                    pieces.append(chunk)
                    chunk = ""
                chunk += char
            if chunk:
                pieces.append(chunk)
        for piece in pieces:
            if current and text_width(current.rstrip() + piece) > max_width:
                lines.append(current.rstrip())
                current = ""
            current += piece
    if current.strip():
        lines.append(current.strip())
    return lines or [""]


@dataclass(frozen=True)
class Box:
    id: str
    x: int
    y: int
    width: int
    height: int
    lines: tuple[str, ...]


def layout_graph(nodes, edges):
    """Return (width, height, boxes, routes) in stable input order.

    Edges are routed through a reserved horizontal lane below each rank, so
    their labels cannot cover a node. Cycles and backward edges use a side lane.
    """
    ids = [node["id"] for node in nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("graph node IDs must be unique")
    by_id = {node["id"]: node for node in nodes}
    for edge in edges:
        if edge["from"] not in by_id or edge["to"] not in by_id:
            raise ValueError(f"graph edge has an unknown endpoint: {edge}")
        if not str(edge.get("label", "")).strip():
            raise ValueError("graph edge needs a concrete label")

    incoming = {id_: 0 for id_ in ids}
    outgoing = {id_: [] for id_ in ids}
    for edge in edges:
        if edge["from"] != edge["to"]:
            incoming[edge["to"]] += 1
            outgoing[edge["from"]].append(edge["to"])
    ready = [id_ for id_ in ids if incoming[id_] == 0]
    ranks = {id_: 0 for id_ in ids}
    visited = set()
    while ready:
        id_ = ready.pop(0)
        visited.add(id_)
        for target in outgoing[id_]:
            ranks[target] = max(ranks[target], ranks[id_] + 1)
            incoming[target] -= 1
            if incoming[target] == 0:
                ready.append(target)
    # A cyclic graph still renders. Assign unresolved nodes to later ranks in
    # input order; the side lane below shows reverse edges explicitly.
    for id_ in ids:
        if id_ not in visited:
            ranks[id_] = max(ranks.values(), default=0) + 1

    groups = {}
    for id_ in ids:
        groups.setdefault(ranks[id_], []).append(id_)
    lane_sizes = {}
    for edge in edges:
        source_rank, target_rank = ranks[edge["from"]], ranks[edge["to"]]
        if target_rank == source_rank + 1:
            lane_sizes.setdefault(source_rank, []).append(max(28, len(wrap_label(edge["label"], 180)) * 20 + 8))
    box_width = 244
    column_gap = 44
    row_gap = 120
    left = 28
    top = 24
    boxes = {}
    rank_bottom = {}
    y = top
    max_columns = max((len(group) for group in groups.values()), default=1)
    for rank in sorted(groups):
        heights = []
        for column, id_ in enumerate(groups[rank]):
            node = by_id[id_]
            lines = tuple(wrap_label(node.get("label", "")))
            detail = tuple(wrap_label(node.get("detail", ""))) if node.get("detail") else ()
            all_lines = lines + detail
            height = max(64, 24 + 22 * len(all_lines))
            boxes[id_] = Box(id_, left + column * (box_width + column_gap), y, box_width, height, all_lines)
            heights.append(height)
        rank_bottom[rank] = y + max(heights, default=64)
        y = rank_bottom[rank] + max(row_gap, 45 + sum(lane_sizes.get(rank, [])))

    content_right = left + max_columns * box_width + (max_columns - 1) * column_gap
    side_count = sum(ranks[edge["to"]] != ranks[edge["from"]] + 1 for edge in edges)
    width = content_right + (240 + side_count * 18 if side_count else 100)
    routes = []
    side_index = 0
    lane_uses = {}
    for edge in edges:
        source, target = boxes[edge["from"]], boxes[edge["to"]]
        source_rank, target_rank = ranks[source.id], ranks[target.id]
        if target_rank == source_rank + 1:
            key = source_rank
            lane = lane_uses.get(key, 0)
            lane_uses[key] = lane + 1
            lane_y = rank_bottom[key] + 34 + sum(lane_sizes[key][:lane])
            start_x = source.x + source.width // 2
            end_x = target.x + target.width // 2
            points = ((start_x, source.y + source.height), (start_x, lane_y),
                      (end_x, lane_y), (end_x, target.y))
            label_x = (start_x + end_x) // 2
            label_y = lane_y - 7
        else:
            side_index += 1
            side_x = content_right + 112 + side_index * 18
            points = ((source.x + source.width, source.y + source.height // 2),
                      (side_x, source.y + source.height // 2),
                      (side_x, target.y + target.height // 2),
                      (target.x + target.width, target.y + target.height // 2))
            label_x = side_x
            label_y = (source.y + target.y) // 2
        routes.append({"points": points, "label": edge["label"],
                       "label_x": label_x, "label_y": label_y, "edge": edge})
    height = max((box.y + box.height for box in boxes.values()), default=0) + 32
    return width, height, boxes, routes

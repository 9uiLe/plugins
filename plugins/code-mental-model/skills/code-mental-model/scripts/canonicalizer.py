"""Turn validated raw analysis into one stable semantic representation."""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from collections.abc import Mapping

from analysis_json import RawEdge, RawMentalModelAnalysis, RawNode
from code_lens import build_code_lens
from domain import (
    Edge, EdgeId, ExecutionScenario, Layer, MentalModel, Node, NodeId,
    SourceLocation, SourcePath,
)
from hashing import stable_digest


def slug(value: str) -> str:
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", unicodedata.normalize("NFKC", value))
    ascii_value = spaced.casefold().encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-") or "node"


def node_id(raw: RawNode, base_count: int) -> NodeId:
    base = slug(raw.label)
    if base_count == 1:
        return NodeId(base)
    origin = str(raw.source.path) if raw.source else raw.kind.value
    suffix = stable_digest(f"{origin}:{raw.label}".encode("utf-8"))[:12]
    return NodeId(f"{base}--{suffix}")


def edge_id(raw: RawEdge, from_id: NodeId, to_id: NodeId, base_count: int) -> EdgeId:
    base = f"{from_id}--{raw.kind.value}--{to_id}--{slug(raw.label)}"
    if base_count == 1:
        return EdgeId(base)
    origin = f"{raw.source.path if raw.source else ''}:{raw.source.start_line if raw.source else 0}:{raw.label}"
    suffix = stable_digest(origin.encode("utf-8"))[:12]
    return EdgeId(f"{base}--{suffix}")


def _source_order(source: SourceLocation | None) -> tuple[str, int]:
    return (str(source.path), source.start_line) if source else ("", 0)


def node_order(node: Node) -> tuple[int, str, str, int, str]:
    path, line = _source_order(node.source)
    return (list(Layer).index(node.layer), node.kind.value, path, line, node.id)


def edge_order(edge: Edge, node_positions: Mapping[NodeId, int]) -> tuple[int, int, str, str, int, str]:
    path, line = _source_order(edge.source)
    return (node_positions[edge.from_id], node_positions[edge.to_id],
            edge.kind.value, path, line, edge.id)


def scenario_order(scenario: ExecutionScenario) -> tuple[int, str]:
    return ({"first": 0, "repeat": 1}.get(scenario, 99), scenario)


def canonicalize(analysis: RawMentalModelAnalysis,
                 contents: Mapping[SourcePath, str]) -> MentalModel:
    bases = Counter(slug(raw.label) for raw in analysis.nodes)
    keys: dict[str, NodeId] = {}
    node_ids: set[NodeId] = set()
    nodes: list[Node] = []
    for raw_node in analysis.nodes:
        node_ident = node_id(raw_node, bases[slug(raw_node.label)])
        if raw_node.key in keys or node_ident in node_ids:
            raise ValueError(f"duplicate node key or id: {raw_node.key}")
        keys[raw_node.key] = node_ident
        node_ids.add(node_ident)
        nodes.append(Node(node_ident, unicodedata.normalize("NFC", raw_node.label.strip()),
                          raw_node.kind, raw_node.layer, raw_node.status, raw_node.state, raw_node.role_code,
                          raw_node.source, build_code_lens(raw_node.source, contents)))
    nodes.sort(key=node_order)
    positions = {node.id: index for index, node in enumerate(nodes)}
    edge_bases: Counter[str] = Counter()
    for raw_edge in analysis.edges:
        if raw_edge.from_key not in keys or raw_edge.to_key not in keys:
            raise ValueError("edge endpoint is not a node key")
        edge_bases[f"{keys[raw_edge.from_key]}--{raw_edge.kind.value}--{keys[raw_edge.to_key]}--{slug(raw_edge.label)}"] += 1
    edge_ids: set[EdgeId] = set()
    edges: list[Edge] = []
    for raw_edge in analysis.edges:
        from_id, to_id = keys[raw_edge.from_key], keys[raw_edge.to_key]
        base = f"{from_id}--{raw_edge.kind.value}--{to_id}--{slug(raw_edge.label)}"
        edge_ident = edge_id(raw_edge, from_id, to_id, edge_bases[base])
        if edge_ident in edge_ids:
            raise ValueError(f"duplicate edge id: {edge_ident}")
        edge_ids.add(edge_ident)
        edges.append(Edge(edge_ident, from_id, to_id, raw_edge.kind,
                          unicodedata.normalize("NFC", raw_edge.label.strip()),
                          unicodedata.normalize("NFC", raw_edge.data.strip()),
                          raw_edge.condition, raw_edge.change, raw_edge.status, raw_edge.source,
                          build_code_lens(raw_edge.source, contents),
                          tuple(sorted(raw_edge.execution, key=lambda pair: scenario_order(pair[0])))))
    edges.sort(key=lambda edge: edge_order(edge, positions))
    scenarios = tuple(sorted({scenario for edge in edges for scenario, _ in edge.execution},
                             key=scenario_order))
    return MentalModel(unicodedata.normalize("NFC", analysis.title.strip()),
                       analysis.summary_code, tuple(nodes), tuple(edges), scenarios)

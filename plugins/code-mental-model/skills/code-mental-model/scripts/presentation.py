"""Prepare localized, display-ready data from a mental model and its layout."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Mapping

from domain import CodeLens, Edge, EdgeId, EdgeKind, EvidenceStatus, MentalModel, Node, NodeId, SourceLocation
from layout_engine import best_layout
from layout_model import GraphLayout
from localization import (UI_EN, UI_JA, edge_sentence, execution_condition_text, execution_step_title,
                          graph_description, role_text, scenario_text, summary_text)
from model_json import ModelDocument, change_tag

KEYWORDS = frozenset("and as assert async await break case class continue def del elif else except False finally for from global if import in is lambda match None nonlocal not or pass raise return self True try while with yield let const var func fun public private internal sealed interface suspend override static new null undefined switch default throw throws guard else if".split())
TOKEN_RE = re.compile(r"#[^\n]*|(?:\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*')|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[=!<>+*/%-]+|\s+|.", re.S)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def highlighted(line: str) -> str:
    parts: list[str] = []
    previous = ""
    expect = ""
    for match in TOKEN_RE.finditer(line):
        token = match.group()
        category = ""
        if token.startswith("#"):
            category = "comment"
        elif token.startswith(("'", '"')):
            category = "string"
        elif token[0].isdigit():
            category = "number"
        elif token in KEYWORDS:
            category = "keyword"
        elif re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", token):
            category = expect if expect else ("member" if previous == "." else "")
        elif token[0] in "=!<>+*/%-":
            category = "operator"
        parts.append(f'<span class="tok-{category}">{esc(token)}</span>' if category else esc(token))
        if token.strip():
            expect = "function" if token in ("def", "func", "fun") else "type" if token in ("class", "interface") else ""
            previous = token
    return "".join(parts)


def code_lens_html(lens: CodeLens | None, change: str, locale: str) -> str:
    if lens is None:
        return '<p class="source">対応コードは未確認です。</p>' if locale == "ja-JP" else '<p class="source">Source code unconfirmed.</p>'
    location = f'{esc(lens.path)}:{lens.start_line}–{lens.end_line}'
    rows: list[str] = []
    for line in lens.lines:
        number = line.number
        focus = lens.focus_start <= number <= lens.focus_end
        changed = focus and change in ("added", "removed", "changed")
        removed = change == "removed"
        marker = "−" if changed and removed else "+" if changed and change == "added" else "Δ" if changed else "│"
        classes = "code-row" + (" is-focus" if focus else "") + (" is-change" if changed else "") + (" removed" if removed else "")
        rows.append(f'<span class="{classes}"><span class="gutter" aria-hidden="true">{esc(marker)} {number}</span><code>{highlighted(line.text)}</code></span>')
    return f'<div class="code-lens"><div class="lens-top"><span>CODE LENS</span><span>{location}</span></div><pre>{"".join(rows)}</pre></div>'


@dataclass(frozen=True, slots=True)
class EvidencePresentation:
    heading: str
    status: str
    status_label: str
    source_label: str


def evidence(status: EvidenceStatus, source: SourceLocation | None, locale: str) -> EvidencePresentation:
    labels = ({"confirmed": "確認済み", "inferred": "推定", "unknown": "未確認"} if locale == "ja-JP" else {"confirmed": "Confirmed", "inferred": "Inferred", "unknown": "Unknown"})
    source_label = (f"{source.path}:{source.start_line}–{source.end_line}" if source is not None else
                    ("出典位置未確認" if locale == "ja-JP" else "Source location unconfirmed"))
    return EvidencePresentation("根拠" if locale == "ja-JP" else "Evidence", status.value, labels[status.value], source_label)


@dataclass(frozen=True, slots=True)
class EvidenceSummary:
    title: str
    confirmed_label: str
    inferred_label: str
    unknown_label: str
    confirmed: int
    inferred: int
    unknown: int
    total: int
    source_count: int
    coverage_label: str
    inferred_summary: str
    unknown_summary: str
    inferred_heading: str
    unknown_heading: str
    inferred_items: tuple[str, ...]
    unknown_items: tuple[str, ...]


def evidence_summary(model: MentalModel, locale: str) -> EvidenceSummary:
    counts = {status: sum(node.status == status for node in model.nodes) +
              sum(edge.status == status for edge in model.edges) for status in EvidenceStatus}
    source_count = sum(node.source is not None for node in model.nodes) + sum(edge.source is not None for edge in model.edges)
    total = len(model.nodes) + len(model.edges)
    inferred_nodes = sum(node.status == EvidenceStatus.INFERRED for node in model.nodes)
    inferred_edges = sum(edge.status == EvidenceStatus.INFERRED for edge in model.edges)
    unknown_nodes = sum(node.status == EvidenceStatus.UNKNOWN for node in model.nodes)
    unknown_edges = sum(edge.status == EvidenceStatus.UNKNOWN for edge in model.edges)
    names = {node.id: node.label for node in model.nodes}

    def items_for(status: EvidenceStatus) -> tuple[str, ...]:
        nodes = (node.label for node in model.nodes if node.status == status)
        edges = (f"{names[edge.from_id]} → {names[edge.to_id]} · {edge.label}"
                 for edge in model.edges if edge.status == status)
        return tuple((*nodes, *edges))

    inferred_items = items_for(EvidenceStatus.INFERRED)
    unknown_items = items_for(EvidenceStatus.UNKNOWN)
    if locale == "ja-JP":
        return EvidenceSummary("モデル全体の根拠", "確認済み", "推定", "未確認", counts[EvidenceStatus.CONFIRMED], counts[EvidenceStatus.INFERRED], counts[EvidenceStatus.UNKNOWN], total, source_count,
                               f"出典位置あり {source_count}/{total} 件", f"推定: ノード {inferred_nodes} 件、接続 {inferred_edges} 件", f"未確認: ノード {unknown_nodes} 件、接続 {unknown_edges} 件",
                               "推定した対象", "未確認の対象", inferred_items, unknown_items)
    def node_word(count: int) -> str:
        return "node" if count == 1 else "nodes"

    def edge_word(count: int) -> str:
        return "connection" if count == 1 else "connections"
    return EvidenceSummary("Evidence summary", "Confirmed", "Inferred", "Unknown", counts[EvidenceStatus.CONFIRMED], counts[EvidenceStatus.INFERRED], counts[EvidenceStatus.UNKNOWN], total, source_count,
                           f"Source locations: {source_count}/{total}", f"Inferred: {inferred_nodes} {node_word(inferred_nodes)}, {inferred_edges} {edge_word(inferred_edges)}", f"Unknown: {unknown_nodes} {node_word(unknown_nodes)}, {unknown_edges} {edge_word(unknown_edges)}",
                           "Inferred items", "Unknown items", inferred_items, unknown_items)


@dataclass(frozen=True, slots=True)
class NodePresentation:
    node: Node
    role: str
    visible_role: str
    meaning: str
    evidence: EvidencePresentation
    code_lens_html: str


@dataclass(frozen=True, slots=True)
class EdgePresentation:
    edge: Edge
    change: str
    meaning: str
    evidence: EvidencePresentation
    code_lens_html: str


@dataclass(frozen=True, slots=True)
class ExecutionStepPresentation:
    scenario: str
    edge_id: EdgeId
    number: int
    scenario_label: str
    title: str
    action: str
    condition: str
    note: str


def execution_steps(model: MentalModel, locale: str) -> tuple[ExecutionStepPresentation, ...]:
    names = {node.id: node.label for node in model.nodes}
    steps: list[ExecutionStepPresentation] = []
    for scenario in model.scenarios:
        ordered = sorted(((int(number), edge) for edge in model.edges
                          for name, number in edge.execution if name == scenario),
                         key=lambda entry: (entry[0], str(entry[1].id)))
        for number, edge in ordered:
            previous_lookups = [candidate for previous_number, candidate in ordered
                                if previous_number < number and candidate.kind in (EdgeKind.READS, EdgeKind.FETCHES)]
            lookup_edge = previous_lookups[-1] if previous_lookups else None
            lookup = (names[lookup_edge.to_id], lookup_edge.label) if lookup_edge is not None else None
            steps.append(ExecutionStepPresentation(
                scenario=str(scenario), edge_id=edge.id, number=number,
                scenario_label=scenario_text(str(scenario), locale),
                title=execution_step_title(number, names[edge.from_id], names[edge.to_id], locale),
                action=edge_sentence(edge.kind, names[edge.from_id], names[edge.to_id], edge.label, locale),
                condition=execution_condition_text(edge.condition, model.summary_code, lookup, locale),
                note=edge.data,
            ))
    return tuple(steps)


@dataclass(frozen=True, slots=True)
class PresentationModel:
    title: str
    locale: str
    summary: str
    ui: Mapping[str, str]
    scenarios: tuple[tuple[str, str], ...]
    graph_description: str
    execution_steps: tuple[ExecutionStepPresentation, ...]
    evidence_summary: EvidenceSummary
    nodes: tuple[NodePresentation, ...]
    edges: tuple[EdgePresentation, ...]
    desktop: GraphLayout
    mobile: GraphLayout


def build_presentation(document: ModelDocument,
                       desktop: GraphLayout, mobile: GraphLayout) -> PresentationModel:
    model: MentalModel = document.model
    locale = document.header.locale
    names: dict[NodeId, str] = {node.id: node.label for node in model.nodes}
    nodes = tuple(NodePresentation(
        node=node,
        role=role_text(node.role_code, locale),
        visible_role=role_text(node.role_code, locale) + (" ?" if node.status.value == "unknown" else ""),
        meaning=f"{role_text(node.role_code, locale)} · {node.state.value}",
        evidence=evidence(node.status, node.source, locale),
        code_lens_html=code_lens_html(node.code_lens, "existing", locale),
    ) for node in model.nodes)
    edges: list[EdgePresentation] = []
    for edge in model.edges:
        change = change_tag(edge.change)
        sentence = edge_sentence(edge.kind, names[edge.from_id], names[edge.to_id], edge.label, locale)
        change_text = ({"added": "差分で追加された接続です。", "changed": "差分で変更された接続です。", "removed": "差分で削除された接続です。", "existing": ""} if locale == "ja-JP" else {"added": "This connection was added.", "changed": "This connection changed.", "removed": "This connection was removed.", "existing": ""})[change]
        info = f" {edge.data}." if edge.data else ""
        edges.append(EdgePresentation(edge, change, f"{sentence} {change_text}{info}", evidence(edge.status, edge.source, locale), code_lens_html(edge.code_lens, change, locale)))
    return PresentationModel(
        title=model.title, locale=locale, summary=summary_text(model.summary_code, locale),
        ui=UI_JA if locale == "ja-JP" else UI_EN,
        scenarios=tuple((str(name), scenario_text(str(name), locale)) for name in model.scenarios),
        graph_description=graph_description(locale), execution_steps=execution_steps(model, locale),
        evidence_summary=evidence_summary(model, locale), nodes=nodes, edges=tuple(edges),
        desktop=desktop, mobile=mobile,
    )


def present(document: ModelDocument) -> PresentationModel:
    return build_presentation(document, best_layout(document.model, False),
                              best_layout(document.model, True))

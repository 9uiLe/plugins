#!/usr/bin/env python3
"""Serialize prepared presentations as deterministic HTML and SVG."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from domain import NodeKind, StateKind
from infrastructure import HtmlAssets, read_html_assets
from layout_model import LabelPlacement
from model_json import parse_model_json
from presentation import EdgePresentation, EvidencePresentation, NodePresentation, PresentationModel, esc

def node_svg(item: NodePresentation, x: int, y: int, w: int, h: int) -> str:
    node = item.node
    ident = esc(node.id)
    kind = node.kind.value
    if node.kind == NodeKind.EXTERNAL_SYSTEM:
        points = f"{x-w//2+15},{y-h//2} {x+w//2-15},{y-h//2} {x+w//2},{y} {x+w//2-15},{y+h//2} {x-w//2+15},{y+h//2} {x-w//2},{y}"
        shape = f'<polygon class="shape" points="{points}"/>'
    elif node.kind in (NodeKind.ENTITY, NodeKind.VALUE):
        shape = f'<path class="shape" d="M{x-w//2} {y-h//2} H{x+w//2-18} L{x+w//2} {y-h//2+18} V{y+h//2} H{x-w//2} Z"/>'
    else:
        shape = f'<rect class="shape" x="{x-w//2}" y="{y-h//2}" width="{w}" height="{h}" rx="7"/>'
        if node.state in (StateKind.OWNED, StateKind.PERSISTENT):
            shape += f'<rect class="inner" x="{x-w//2+5}" y="{y-h//2+5}" width="{w-10}" height="{h-10}" rx="4"/>'
    label = esc(node.label)
    return f'<a class="graph-link node {esc(node.status.value)} {esc(kind)} role-{esc(node.role_code.value)}" href="#detail-{ident}" data-detail="{ident}">{shape}<text class="name" x="{x}" y="{y-3}">{label}</text><text class="role" x="{x}" y="{y+15}">{esc(item.visible_role)}</text><title>{label} · {esc(kind)} · {esc(item.role)} · {esc(node.status.value)}</title></a>'


def edge_svg(item: EdgePresentation, route: tuple[tuple[int, int], ...], placement: LabelPlacement) -> str:
    edge = item.edge
    lx, ly, label = placement.x, placement.y, placement.text
    path = "M" + " L".join(f"{x} {y}" for x, y in route)
    ident = esc(edge.id)
    execution = json.dumps({key: value for key, value in edge.execution}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    prefix = {"added": "+ ", "removed": "− ", "changed": "Δ "}.get(item.change, "")
    label_content = f'<tspan class="change-prefix">{esc(prefix)}</tspan><tspan>{esc(label[len(prefix):])}</tspan>' if prefix else esc(label)
    leader_path = f'M{placement.attachment[0]} {placement.attachment[1]} L{placement.anchor[0]} {placement.anchor[1]}'
    leader = (f'<path class="label-leader-halo" d="{leader_path}"/><path class="label-leader" d="{leader_path}"/>'
              f'<circle class="label-anchor" cx="{placement.anchor[0]}" cy="{placement.anchor[1]}" r="3"/>') if placement.show_leader else ""
    return f'<a class="graph-link edge {esc(item.change)} {esc(edge.status.value)}" href="#detail-{ident}" data-detail="{ident}" data-from="{esc(edge.from_id)}" data-to="{esc(edge.to_id)}" data-execution="{esc(execution)}"><path class="line" d="{path}"/><path class="hit" d="{path}"/>{leader}<text class="edge-label" x="{lx}" y="{ly}">{label_content}</text><text class="step" x="{lx}" y="{ly}"></text><title>{esc(edge.kind.value)}: {esc(edge.label)}</title></a>'


def graph_svg(view: PresentationModel, mobile: bool) -> str:
    layout = view.mobile if mobile else view.desktop
    edges = [edge_svg(item, layout.routes[item.edge.id], layout.labels[item.edge.id]) for item in view.edges]
    nodes = [node_svg(item, *layout.coords[item.node.id], *layout.sizes[item.node.id]) for item in view.nodes]
    label = "mobile" if mobile else "desktop"
    desc = view.graph_description
    title = esc(view.ui["MAP_TITLE"])
    return f'<svg class="graph graph-{label}" viewBox="0 0 {layout.width} {layout.height}" style="max-width:{layout.width}px;margin-inline:auto" data-layout="{layout.candidate}" data-readability-cost="{layout.metrics["cost"]}" role="img" aria-label="{title}" xmlns="http://www.w3.org/2000/svg"><title>{title}</title><desc>{desc}</desc>{"".join(edges)}{"".join(nodes)}</svg>'


def markers() -> str:
    items = [f'<marker id="{key}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z"/></marker>' for key in ("arrow", "arrow-focus", "arrow-add")]
    return '<svg class="marker-defs" width="0" height="0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>'+''.join(items)+'</defs></svg>'


def detail_evidence(item: EvidencePresentation) -> str:
    return f'<div class="detail-evidence"><strong>{esc(item.heading)}</strong><span class="evidence-status {esc(item.status)}">{esc(item.status_label)}</span><span class="evidence-source">{esc(item.source_label)}</span></div>'


def details(view: PresentationModel) -> str:
    names = {item.node.id: item.node.label for item in view.nodes}
    output: list[str] = []
    for item in view.nodes:
        node = item.node
        output.append(f'<article class="detail" id="detail-{esc(node.id)}" data-detail="{esc(node.id)}"><h3>{esc(node.label)}</h3><p class="meaning">{esc(item.meaning)}</p>{detail_evidence(item.evidence)}{item.code_lens_html}</article>')
    for edge_item in view.edges:
        edge = edge_item.edge
        title = f'{esc(names[edge.from_id])} → {esc(names[edge.to_id])} · {esc(edge.label)}'
        output.append(f'<article class="detail" id="detail-{esc(edge.id)}" data-detail="{esc(edge.id)}"><h3>{title}</h3><p class="meaning">{esc(edge_item.meaning)}</p>{detail_evidence(edge_item.evidence)}{edge_item.code_lens_html}</article>')
    return "\n".join("        " + part for part in output)


def execution_steps(view: PresentationModel) -> str:
    output: list[str] = []
    for step in view.execution_steps:
        condition = f'<p class="step-condition">{esc(step.condition)}</p>' if step.condition else ""
        note_label = "補足" if view.locale == "ja-JP" else "Note"
        note = f'<p class="step-note"><strong>{note_label}</strong> {esc(step.note)}</p>' if step.note else ""
        output.append(
            f'<article class="step-detail" data-step-scenario="{esc(step.scenario)}" '
            f'data-step-edge="{esc(step.edge_id)}" hidden><p class="step-scenario">{esc(step.scenario_label)}</p>'
            f'<h3>{esc(step.title)}</h3><p class="step-action">{esc(step.action)}</p>{condition}{note}</article>'
        )
    return "\n".join("          " + part for part in output)


def evidence_summary(view: PresentationModel) -> str:
    summary = view.evidence_summary
    counts = ((summary.confirmed_label, summary.confirmed, "confirmed"),
              (summary.inferred_label, summary.inferred, "inferred"),
              (summary.unknown_label, summary.unknown, "unknown"))
    statistics = "".join(f'<div class="evidence-stat {kind}"><dt>{esc(label)}</dt><dd>{count}</dd></div>' for label, count, kind in counts)
    def group(title: str, items: tuple[str, ...]) -> str:
        if not items:
            return ""
        listed = "".join(f"<li>{esc(item)}</li>" for item in items)
        return f'<div class="evidence-group"><h3>{esc(title)}</h3><ul>{listed}</ul></div>'

    groups = group(summary.inferred_heading, summary.inferred_items) + group(summary.unknown_heading, summary.unknown_items)
    return f'<h2>{esc(summary.title)}</h2><dl class="evidence-stats">{statistics}</dl><p class="evidence-coverage">{esc(summary.coverage_label)}</p><p class="evidence-note">{esc(summary.inferred_summary)}<br>{esc(summary.unknown_summary)}</p><div class="evidence-groups">{groups}</div>'


def serialize(view: PresentationModel, assets: HtmlAssets) -> bytes:
    locale = view.locale
    scenarios = "".join(f'<button type="button" data-scenario="{esc(name)}" aria-pressed="{str(i==0).lower()}">{esc(label)}</button>' for i, (name, label) in enumerate(view.scenarios))
    execution_button = (f'<button type="button" data-mode="execution" aria-pressed="false">{esc(view.ui["EXECUTION_MODE"])}</button>'
                        if view.scenarios else "")
    template = assets.template
    values = {"__LANG__": "ja" if locale == "ja-JP" else "en", "__LOCALE__": locale, "__TITLE__": esc(view.title), "__SUMMARY__": esc(view.summary),
              "__INITIAL_SCENARIO__": esc(view.scenarios[0][0]) if view.scenarios else "",
              "__EXECUTION_MODE_BUTTON__": execution_button, "__SCENARIO_BUTTONS__": scenarios,
              "__MARKERS__": markers(), "__DESKTOP_SVG__": graph_svg(view, False),
              "__MOBILE_SVG__": graph_svg(view, True), "__DETAILS__": details(view),
              "__EXECUTION_STEPS__": execution_steps(view), "__EVIDENCE_SUMMARY__": evidence_summary(view),
              "__CSS__": assets.css.rstrip("\n"),
              "__JS__": assets.javascript.rstrip("\n")}
    values.update({f"__{key}__": esc(value) for key, value in view.ui.items()})
    template = template.replace('<div class="map-canvas">', '<div class="map-canvas">\n__MARKERS__', 1)

    def substitute(match: re.Match[str]) -> str:
        if match.group() not in values:
            raise ValueError(f"unfilled template placeholder: {match.group()}")
        return values[match.group()]

    template = re.sub(r"__[A-Z_]+__", substitute, template)
    return (template.replace("\r\n", "\n").rstrip("\n") + "\n").encode("utf-8")


def render(model: object) -> bytes:
    from generate_application import generate_artifact
    return generate_artifact(parse_model_json(json.dumps(model, ensure_ascii=False)),
                             read_html_assets(Path(__file__).resolve().parent.parent))


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--model", type=Path, required=True)
    cli.add_argument("--output", type=Path)
    args = cli.parse_args()
    output = args.output or args.model.parent / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    from generate_application import generate_artifact
    output.write_bytes(generate_artifact(parse_model_json(args.model.read_text(encoding="utf-8")),
                                         read_html_assets(Path(__file__).resolve().parent.parent)))
    print(output)


if __name__ == "__main__":
    main()

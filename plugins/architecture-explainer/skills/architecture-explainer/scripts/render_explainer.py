"""Render Presentation IR and an evidence-backed Explanation Model to standalone HTML.

The IR selects model IDs and views. Claims, status, terminology, code references,
markup, layout and styles come from the model or this renderer. Python 3 stdlib.
"""

import argparse
from html import escape
import json
from pathlib import Path
import re
import sys

from graph_layout import layout_graph


ROOT = Path(__file__).resolve().parents[1]
VIEWS = {
    "overview", "system_context", "component_map", "sequence", "runtime_flow",
    "state_transition", "data_flow", "decision", "before_after",
    "change_impact", "code_map", "known_unknowns", "callout", "takeaway",
}
THEMES = {"technical", "cards"}
TEMPLATES = {"doc"}
KINDS = {
    "purpose": {"overview", "callout", "takeaway"},
    "actor": {"overview", "system_context"},
    "external": {"overview", "system_context"},
    "component": {"overview", "component_map", "code_map", "callout", "takeaway"},
    "scenario": {"sequence", "runtime_flow", "overview"},
    "state": {"state_transition"},
    "data": {"data_flow"},
    "decision": {"decision", "callout"},
    "invariant": {"callout", "takeaway", "change_impact"},
    "change": {"overview", "before_after", "change_impact", "callout"},
    "unknown": {"known_unknowns", "callout"},
    "evidence": {"code_map"},
}
STATUS_LABELS = {"observed": "確認済み", "inferred": "推論", "unknown": "不明"}
COMPONENT_LEVELS = {"system", "container", "module", "class", "function"}
# An actor or external system is an interaction participant, not a level in
# the component hierarchy. Each allowed pair belongs to one reader-facing band.
RUNTIME_PAIRS = {
    frozenset(("actor", "system")): "system",
    frozenset(("actor", "container")): "container",
    frozenset(("external", "system")): "system",
    frozenset(("external", "container")): "container",
    frozenset(("system",)): "system",
    frozenset(("container",)): "container",
    frozenset(("module",)): "module",
    frozenset(("class",)): "class",
    frozenset(("function",)): "function",
}


def e(value):
    return escape(str(value or ""), quote=True)


def validate_ir(ir, model):
    if not isinstance(ir, dict) or ir.get("template", "doc") not in TEMPLATES:
        raise ValueError("Presentation IR needs template 'doc'")
    if ir.get("theme", "technical") not in THEMES:
        raise ValueError(f"unknown theme: {ir.get('theme')}")
    sections = ir.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("Presentation IR needs a non-empty sections array")
    known = source_index(model)
    seen = set()
    for number, section in enumerate(sections):
        if not isinstance(section, dict):
            raise ValueError(f"sections[{number}] must be an object")
        id_, question, view = (section.get(key) for key in ("id", "question", "view"))
        if not isinstance(id_, str) or not re.fullmatch(r"[a-z][a-z0-9-]*", id_):
            raise ValueError(f"sections[{number}].id needs a stable lowercase anchor")
        if id_ in seen:
            raise ValueError(f"duplicate section ID: {id_}")
        seen.add(id_)
        if not isinstance(question, str) or not question.strip():
            raise ValueError(f"sections[{number}].question is required")
        if view not in VIEWS:
            raise ValueError(f"sections[{number}].view is unknown: {view}")
        sources = section.get("sources")
        if not isinstance(sources, list) or not sources or any(not isinstance(x, str) for x in sources):
            raise ValueError(f"sections[{number}].sources needs model IDs")
        if len(sources) != len(set(sources)):
            raise ValueError(f"sections[{number}].sources contains duplicates")
        for source in sources:
            if source not in known:
                raise ValueError(f"sections[{number}] references unknown model ID: {source}")
            if view not in KINDS[known[source][0]]:
                raise ValueError(f"{source} ({known[source][0]}) cannot be used in {view}")
        if "density" in section and section["density"] not in ("comfortable", "compact"):
            raise ValueError(f"sections[{number}].density must be comfortable or compact")
        if "emphasis" in section and section["emphasis"] not in ("normal", "strong"):
            raise ValueError(f"sections[{number}].emphasis must be normal or strong")
    if sections[0]["id"] != "what" or sections[0]["view"] != "overview":
        raise ValueError("the first section must be id 'what' with view 'overview'")
    if "purpose" not in sections[0]["sources"]:
        raise ValueError("the first section must select purpose")
    if sum(known[source][0] in {"actor", "external", "component"}
           for source in sections[0]["sources"]) > 3:
        raise ValueError("first-view overview may select at most three nodes; use a focused section for more")
    for section in sections:
        if section["view"] == "component_map":
            for source in section["sources"]:
                for dependency in known[source][1].get("depends_on", []):
                    target = dependency.get("target")
                    if target not in known or known[target][0] != "component":
                        raise ValueError(f"component map has unknown graph endpoint: {target}")
        if section["view"] == "data_flow":
            for source in section["sources"]:
                data = known[source][1]
                for endpoint in data.get("written_by", []) + data.get("read_by", []):
                    if endpoint not in known or known[endpoint][0] != "component":
                        raise ValueError(f"data flow has unknown graph endpoint: {endpoint}")
        if section["view"] in {"sequence", "runtime_flow"} and len(section["sources"]) != 1:
            raise ValueError(f"{section['view']} needs one scenario per reader question")
        if section["view"] in {"sequence", "runtime_flow"}:
            scenario = known[section["sources"][0]][1]
            steps = scenario.get("steps", [])
            if not isinstance(steps, list) or not steps:
                raise ValueError(f"{section['view']} needs at least one scenario step")
            bands = set()
            for step in steps:
                participants = []
                for endpoint in (step.get("from"), step.get("to")):
                    if endpoint not in known:
                        raise ValueError(f"scenario step has unknown endpoint: {endpoint}")
                    kind, entity = known[endpoint]
                    if kind not in {"actor", "external", "component"}:
                        raise ValueError(f"scenario endpoint is not an actor or component: {endpoint}")
                    level = kind if kind != "component" else entity.get("level")
                    if kind == "component" and level not in COMPONENT_LEVELS:
                        raise ValueError(f"scenario component {endpoint} needs a known level")
                    participants.append(level)
                band = RUNTIME_PAIRS.get(frozenset(participants))
                if band is None:
                    raise ValueError(f"incompatible runtime participants: {participants[0]} ↔ {participants[1]}")
                bands.add(band)
            if len(bands) > 1:
                raise ValueError("one scenario mixes interaction levels; split reader questions")
    return known


def source_index(model):
    result = {"purpose": ("purpose", model.get("purpose", {}))}
    groups = (("actor", model.get("context", {}).get("actors", [])),
              ("external", model.get("context", {}).get("external_systems", [])),
              ("component", model.get("components", [])),
              ("scenario", model.get("runtime_scenarios", [])),
              ("state", model.get("states", [])), ("data", model.get("data", [])),
              ("decision", model.get("decisions", [])), ("invariant", model.get("invariants", [])),
              ("change", model.get("change_impacts", [])),
              ("unknown", model.get("unknowns", [])), ("evidence", model.get("evidence", [])))
    for kind, items in groups:
        for item in items:
            id_ = item.get("id")
            if not id_ or id_ in result:
                raise ValueError(f"missing or duplicate model ID: {id_}")
            result[id_] = (kind, item)
    return result


class Renderer:
    def __init__(self, model, ir):
        self.model = model
        self.ir = ir
        self.sources = validate_ir(ir, model)
        self.glossary = {item["concept"]: item for item in model.get("glossary", [])}
        self.evidence = {item["id"]: item for item in model.get("evidence", [])}
        self.used_evidence = set()
        self.first_terms = set()

    def term(self, id_):
        entry = self.glossary.get(id_)
        if not entry:
            raise ValueError(f"displayed concept has no glossary entry: {id_}")
        preferred = entry.get("preferred")
        if not preferred:
            raise ValueError(f"glossary preferred term is empty: {id_}")
        # The first mention maps the Japanese term to the source identifier.
        suffix = ""
        if id_ not in self.first_terms:
            code_terms = entry.get("code_terms", [])
            if code_terms and code_terms[0] != preferred:
                suffix = f'（<span data-concept="{e(id_)}"><code>{e(code_terms[0])}</code></span>）'
            self.first_terms.add(id_)
        return f'<span data-concept="{e(id_)}">{e(preferred)}</span>{suffix}'

    def name(self, id_):
        entry = self.glossary.get(id_)
        if not entry or not entry.get("preferred"):
            raise ValueError(f"displayed concept has no glossary entry: {id_}")
        return entry["preferred"]

    def badge(self, claim):
        status = claim.get("status")
        if status not in STATUS_LABELS:
            raise ValueError(f"displayed claim needs observed/inferred/unknown status: {claim.get('id', '')}")
        refs = claim.get("evidence", [])
        if status != "unknown" and not refs:
            raise ValueError(f"{status} claim has no evidence: {claim.get('id', '')}")
        if status == "unknown" and refs:
            raise ValueError(f"unknown claim carries evidence: {claim.get('id', '')}")
        for ref in refs:
            if ref not in self.evidence:
                raise ValueError(f"unresolved evidence ID: {ref}")
            self.used_evidence.add(ref)
        badge = f'<span class="badge" data-evidence="{status}">{STATUS_LABELS[status]}</span>'
        links = " ".join(self.ref(ref) for ref in refs)
        if status == "unknown":
            unknown = next((item for item in self.model.get("unknowns", [])
                            if item.get("about") == claim.get("id")), None)
            if unknown:
                links = f'<a class="unknown-ref" href="#unknown-{e(unknown["id"])}">解消方法</a>'
        return f"{badge} {links}".strip()

    def ref(self, evidence_id):
        item = self.evidence[evidence_id]
        file = item.get("file", "")
        if not file:
            return f'<a class="evidence-ref" href="#source-{e(evidence_id)}">根拠 {e(evidence_id)}</a>'
        attrs = f'data-file="{e(file)}" data-symbol="{e(item.get("symbol", ""))}"'
        if item.get("line"):
            attrs += f' data-line="{e(item["line"])}"'
        return f'<a class="code-ref" href="#source-{e(evidence_id)}" {attrs}>{e(file)}:{e(item.get("line", ""))}</a>'

    def figure(self, section, body, caption=None):
        question = e(section["question"])
        return (f'\n<figure class="view" data-question="{question}">\n{body}\n'
                f'<figcaption>{e(caption or section["question"])}</figcaption></figure>\n')

    def graph(self, section, nodes, edges, caption):
        visual_nodes = []
        for node in nodes:
            visual = dict(node)
            if visual.get("status") in {"inferred", "unknown"}:
                visual["detail"] = (visual.get("detail", "") + " · " + STATUS_LABELS[visual["status"]]).strip(" ·")
            visual_nodes.append(visual)
        width, height, boxes, routes = layout_graph(visual_nodes, edges)
        title_id = f'svg-{section["id"]}-title'
        lines = [f'<svg viewBox="0 0 {width} {height}" width="{width}" role="img" aria-labelledby="{e(title_id)}">',
                 f'<title id="{e(title_id)}">{e(section["question"])}</title>',
                 f'<desc>{e(caption)}</desc>',
                 f'<defs><marker id="arrow-{e(section["id"])}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0 0 L9 3.5 L0 7 Z" class="arrowhead"/></marker></defs>']
        for route in routes:
            points = " ".join(f"{x},{y}" for x, y in route["points"])
            lines.append(f'<polyline class="edge" points="{points}" marker-end="url(#arrow-{e(section["id"])})"/>')
            labels = route["label_lines"]
            x, y = route["label_x"], route["label_y"]
            label_left, label_top, label_width, label_height = route["label_box"]
            lines.append(f'<rect class="edge-label-bg" x="{label_left:.1f}" y="{label_top:.1f}" width="{label_width:.1f}" height="{label_height:.1f}" rx="4"/>')
            lines.append(f'<text class="edge-label arrow-label" x="{x}" y="{y}" text-anchor="middle">')
            for index, label in enumerate(labels):
                lines.append(f'<tspan x="{x}" dy="{0 if index == 0 else 17}">{e(label)}</tspan>')
            lines.append('</text>')
        by_id = {node["id"]: node for node in visual_nodes}
        for id_, box in boxes.items():
            node = by_id[id_]
            status = node.get("status", "observed")
            lines.append(f'<g class="node" data-kind="{e(node["kind"])}" data-evidence="{e(status)}">')
            if id_ in self.glossary:
                lines.append(f'<title data-concept="{e(id_)}">{e(self.name(id_))}</title>')
            lines.append(f'<rect x="{box.x}" y="{box.y}" width="{box.width}" height="{box.height}" rx="9"/>')
            for index, label in enumerate(box.lines):
                lines.append(f'<text x="{box.x + 14}" y="{box.y + 25 + index * 22}">{e(label)}</text>')
            lines.append('</g>')
        lines.append('</svg>')
        return self.figure(section, "\n".join(lines), caption)

    def claim(self, text, claim, concept=None):
        head = self.term(concept) + "：" if concept else ""
        return f'\n<p>{head}{e(text)} {self.badge(claim)}</p>\n'

    def render_view(self, section):
        selected = [self.sources[id_] for id_ in section["sources"]]
        view = section["view"]
        if view == "overview":
            purpose = self.model.get("purpose", {})
            if not purpose.get("problem") or not purpose.get("responsibility"):
                raise ValueError("overview needs purpose.problem and purpose.responsibility")
            lede = f'{e(purpose["problem"])} {self.badge(purpose)}'
            nodes = []
            for kind, item in selected:
                if kind in {"actor", "external", "component"}:
                    nodes.append(f'<div class="node" data-kind="{kind}"><span class="name">{self.term(item["id"])}</span><span class="resp">{e(item.get("role") or item.get("interaction") or item.get("responsibility"))}</span>{self.badge(item)}</div>')
            if not nodes:
                scenarios = [item for kind, item in selected if kind == "scenario"]
                if scenarios:
                    nodes = [f'<div class="node" data-kind="component"><span class="name">{e(step.get("action"))}</span></div>'
                             for step in scenarios[0].get("steps", [])[:3]]
            if not nodes:
                nodes = [f'<div class="node" data-kind="system"><span class="name">{e(self.model.get("subject", {}).get("title"))}</span></div>']
            content = f'<p class="lede">{lede}</p>' + self.figure(section, '<div class="map overview-map">' + "".join(nodes[:3]) + '</div>')
            content += f'<p class="takeaway"><strong>要点</strong> {e(purpose["responsibility"])} {self.badge(purpose)}</p>'
            for kind, item in selected:
                if kind == "scenario":
                    actions = [step.get("action", "") for step in item.get("steps", [])[:2]]
                    if actions:
                        content += f'<p>主要フロー: {e(" → ".join(actions))}</p>'
                if kind == "change":
                    content += self.claim("変更後: " + item.get("after", {}).get("behavior", ""), item.get("after", {}))
                    for verify in item.get("requires_verification", [])[:1]:
                        content += f'<p>最初の確認点: {e(verify.get("target", ""))} — {e(verify.get("reason", ""))}</p>'
            return content
        if view in {"system_context", "component_map", "data_flow"}:
            nodes, edges = [], []
            if view == "system_context":
                nodes.append({"id": "system", "label": self.model.get("subject", {}).get("title", "対象"), "kind": "system", "status": "observed"})
                for kind, item in selected:
                    if kind == "actor":
                        nodes.append({"id": item["id"], "label": self.name(item["id"]), "detail": item.get("role", ""), "kind": kind, "status": item.get("status")})
                        edges.append({"from": item["id"], "to": "system", "label": item.get("role", "対象と関わる")})
                    elif kind == "external":
                        nodes.append({"id": item["id"], "label": self.name(item["id"]), "detail": item.get("interaction", ""), "kind": kind, "status": item.get("status")})
                        edges.append({"from": "system", "to": item["id"], "label": item.get("interaction", "外部と関わる")})
            elif view == "component_map":
                items = [item for kind, item in selected if kind == "component"]
                if len({item.get("level") for item in items}) > 1:
                    raise ValueError("component map cannot mix abstraction levels")
                nodes = [{"id": item["id"], "label": self.name(item["id"]), "detail": item.get("responsibility", ""),
                          "kind": "component", "status": item.get("status")} for item in items]
                ids = {item["id"] for item in items}
                edges = [{"from": item["id"], "to": dep["target"], "label": dep.get("meaning", "")}
                         for item in items for dep in item.get("depends_on", []) if dep.get("target") in ids]
            else:
                items = [item for kind, item in selected if kind == "data"]
                nodes = [{"id": item["id"], "label": self.name(item["id"]), "detail": item.get("stored_in", ""),
                          "kind": "data", "status": item.get("status", "observed")} for item in items]
                for item in items:
                    for writer in item.get("written_by", []):
                        if writer not in {node["id"] for node in nodes}:
                            nodes.append({"id": writer, "label": self.name(writer), "kind": "component", "status": "observed"})
                        edges.append({"from": writer, "to": item["id"], "label": self.name(item["id"]) + "を書き込む"})
                    for reader in item.get("read_by", []):
                        if reader not in {node["id"] for node in nodes}:
                            nodes.append({"id": reader, "label": self.name(reader), "kind": "component", "status": "observed"})
                        edges.append({"from": item["id"], "to": reader, "label": self.name(item["id"]) + "を読み取る"})
            if not nodes:
                raise ValueError(f"{view} needs displayable model nodes")
            content = self.graph(section, nodes, edges, section["question"] + "。矢印は呼ぶ側またはデータの出所から行き先を示す。")
            for kind, item in selected:
                if kind in {"actor", "external", "component", "data"}:
                    source_claim = item if kind != "data" else {**item, "status": item.get("status", "observed")}
                    content += self.claim(item.get("responsibility") or item.get("role") or item.get("interaction") or item.get("stored_in", ""), source_claim, item["id"])
            return content
        if view in {"sequence", "runtime_flow"}:
            result = []
            for _, scenario in selected:
                rows = []
                for step in scenario.get("steps", []):
                    start, end = self.term(step["from"]), self.term(step["to"])
                    if view == "sequence":
                        rows.append(f'<li><span class="lane">{start}</span><span class="msg arrow-label">{e(step["action"])}</span><span class="lane">{end}</span> {self.badge(step)}</li>')
                    else:
                        rows.append(f'<li>{start} → {end}：<span class="arrow-label">{e(step["action"])}</span> {self.badge(step)}</li>')
                for path in scenario.get("exceptional_paths", []):
                    rows.append(f'<li class="alt">条件: {e(path.get("condition"))}。結果: {e(path.get("result"))} {self.badge(path)}</li>')
                rows_html = "\n".join(rows)
                result.append(self.figure(section, f'<p>起点: {e(scenario.get("trigger"))}</p><ol class="{ "seq" if view == "sequence" else "flow"}">\n{rows_html}\n</ol>'))
            return "".join(result)
        if view == "state_transition":
            rows = []
            for _, state in selected:
                for transition in state.get("transitions", []):
                    refs = {"id": state.get("id"), "status": state.get("status", "observed"), "evidence": transition.get("evidence", [])}
                    rows.append(f'<tr><td>{e(state.get("name"))}</td><td>{e(transition.get("event"))}</td><td>{e(transition.get("guard"))}</td><td>{e(transition.get("to"))}</td><td>{self.badge(refs)}</td></tr>')
            return self.figure(section, '<div class="table-wrap"><table class="states"><thead><tr><th>状態</th><th>event</th><th>条件</th><th>遷移先</th><th>根拠</th></tr></thead><tbody>' + "".join(rows) + '</tbody></table></div>')
        if view == "decision":
            parts = []
            for _, item in selected:
                rationale = item.get("rationale", {})
                parts.append('<article class="decision"><h3>設計判断</h3><dl>'
                             f'<dt>文脈</dt><dd>{e(item.get("context"))}</dd>'
                             f'<dt>判断</dt><dd>{e(item.get("decision"))} {self.badge(item)}</dd>'
                             f'<dt>理由</dt><dd>{e(rationale.get("text"))} {self.badge({"id": item.get("id"), **rationale})}</dd>'
                             f'<dt>Trade-off</dt><dd>{e("、".join(item.get("tradeoffs", [])))}</dd>'
                             f'<dt>代替案</dt><dd>{e("、".join(item.get("alternatives", [])))}</dd></dl></article>')
            return self.figure(section, "".join(parts))
        if view in {"before_after", "change_impact"}:
            parts = []
            for _, item in selected:
                if "before" in item:
                    parts.append(f'<div class="change-pair"><div><strong>変更前</strong>{self.claim(item["before"].get("behavior", ""), item["before"])}</div>'
                                 f'<div><strong>変更後</strong>{self.claim(item["after"].get("behavior", ""), item["after"])}</div></div>')
                    impact_keys = (("affected", "affected"), ("unaffected", "unaffected"),
                                   ("requires_verification", "verify")) if view == "change_impact" else (
                                   ("unaffected", "unaffected"), ("requires_verification", "verify"))
                    parts.append('<ul class="impact">')
                    for key, impact in impact_keys:
                        for effect in item.get(key, []):
                            refs = []
                            for ref in effect.get("evidence", []):
                                if ref not in self.evidence:
                                    raise ValueError(f"unresolved change-impact evidence ID: {ref}")
                                self.used_evidence.add(ref)
                                refs.append(self.ref(ref))
                            parts.append(f'<li data-impact="{impact}"><span class="target">{e(effect.get("target"))}</span> — {e(effect.get("reason"))} {" ".join(refs)}</li>')
                    parts.append('</ul>')
                elif "description" in item:
                    parts.append(self.claim(item["description"], item))
            return self.figure(section, "".join(parts))
        if view == "code_map":
            rows = []
            for kind, item in selected:
                if kind == "component":
                    for location in item.get("code_locations", []):
                        rows.append(self.code_row(self.name(item["id"]), item.get("responsibility", ""), location))
                elif kind == "evidence":
                    rows.append(self.code_row(item.get("note", ""), item.get("kind", ""), item))
            return self.figure(section, '<div class="table-wrap"><table class="codemap"><thead><tr><th>対象</th><th>責務・根拠</th><th>source</th></tr></thead><tbody>' + "".join(rows) + '</tbody></table></div>')
        if view == "known_unknowns":
            rows = []
            for _, item in selected:
                rows.append(f'<tr id="unknown-{e(item["id"])}"><td>{e(item.get("question"))}</td><td>{e(item.get("reason"))}</td><td>{e(item.get("how_to_resolve"))}</td></tr>')
            return self.figure(section, '<div class="table-wrap"><table><thead><tr><th>問い</th><th>判断できない理由</th><th>解消方法</th></tr></thead><tbody>' + "".join(rows) + '</tbody></table></div>')
        if view in {"callout", "takeaway"}:
            content = []
            for kind, item in selected:
                value = item.get("description") or item.get("decision") or item.get("change") or item.get("question") or item.get("responsibility")
                claim = item
                if kind == "change":
                    claim = item.get("after", {})
                    value = claim.get("behavior", "")
                elif kind == "unknown":
                    claim = {"id": item.get("about"), "status": "unknown", "evidence": []}
                content.append(self.claim(value, claim, item["id"] if kind == "component" else None))
            return self.figure(section, f'<div class="{view}">{"".join(content)}</div>')
        raise ValueError(f"view is not implemented: {view}")

    def code_row(self, subject, responsibility, location):
        file = e(location.get("file", ""))
        symbol = e(location.get("symbol", ""))
        file_breaks = re.sub(r"/", "/<wbr>", file)
        symbol_breaks = re.sub(r"(::|\.|(?<=[A-Za-z0-9])_)", r"\1<wbr>", symbol)
        evidence_id = next((id_ for id_, item in self.evidence.items()
                            if item.get("file") == location.get("file") and item.get("symbol") == location.get("symbol")), None)
        evidence_link = ""
        if evidence_id:
            self.used_evidence.add(evidence_id)
            evidence_link = " " + self.ref(evidence_id)
        attrs = f'data-file="{file}" data-symbol="{symbol}"'
        if location.get("line"):
            attrs += f' data-line="{e(location["line"])}"'
        return (f'<tr><td data-label="対象">{e(subject)}</td><td data-label="責務・根拠">{e(responsibility)}</td>'
                f'<td data-label="source" {attrs}><span class="src-file">{file_breaks}</span>'
                f'<span class="src-symbol">{symbol_breaks}</span>{evidence_link}</td></tr>')

    def render(self):
        sections = []
        for section in self.ir["sections"]:
            classes = "first-view" if section["id"] == "what" else ""
            if section.get("density"):
                classes += " density-" + section["density"]
            if section.get("emphasis"):
                classes += " emphasis-" + section["emphasis"]
            sections.append(f'<section id="{e(section["id"])}" class="{classes.strip()}"><h2>{e(section["question"])}</h2>{self.render_view(section)}</section>')
        appendix = []
        for id_ in sorted(self.used_evidence):
            item = self.evidence[id_]
            appendix.append(f'<li id="source-{e(id_)}">{e(item.get("kind"))} · {e(item.get("revision"))} · {e(item.get("file"))} {e(item.get("symbol"))} {e(item.get("note"))}</li>')
        if appendix:
            sections.append('<section id="evidence"><h2>根拠一覧</h2><ol>' + "".join(appendix) + '</ol></section>')
        toc = "".join(f'<li><a href="#{e(section["id"])}">{e(section["question"])}</a></li>' for section in self.ir["sections"])
        title = self.model.get("subject", {}).get("title", "Architecture Explainer")
        audience = self.model.get("audience", {}).get("profile", "")
        revision = self.model.get("source", {}).get("revision", "")
        base_css = (ROOT / "assets/explainer-base.css").read_text(encoding="utf-8")
        theme_css = (ROOT / f'assets/theme-{self.ir.get("theme", "technical")}.css').read_text(encoding="utf-8")
        rendered_sections = "\n".join(sections)
        return (f'<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
                f'<title>{e(title)}</title><style>{base_css}\n{theme_css}</style></head><body data-theme="{e(self.ir.get("theme", "technical"))}">'
                '<a class="skip" href="#main">本文へ移動</a>'
                f'<header class="doc-header"><p class="eyebrow">対象: {e(title)} / 読者: {e(audience)} / 根拠: {e(revision)}</p><h1>{e(title)}</h1></header>'
                f'<div class="page"><nav class="toc" aria-label="目次"><ol>{toc}</ol></nav><main id="main">\n{rendered_sections}\n</main></div></body></html>\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("ir", type=Path, help="Presentation IR JSON")
    parser.add_argument("--model", required=True, type=Path, help="Explanation Model JSON")
    parser.add_argument("-o", "--output", required=True, type=Path, help="Standalone HTML output")
    args = parser.parse_args()
    try:
        model = json.loads(args.model.read_text(encoding="utf-8"))
        ir = json.loads(args.ir.read_text(encoding="utf-8"))
        output = Renderer(model, ir).render()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())

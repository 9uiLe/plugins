"""Check an architecture explainer HTML file; print JSON findings.

Checks structure: standalone dependencies, anchors, ids, headings, figure
contracts, evidence markers, element nesting, overflow-prone tables, SVGs and
Code Maps, simple accessibility, limited Japanese language hints, and (with
--source-root) code references. --model checks annotated concept names.
It does not judge whether claims are true. Exit codes: 0 no errors, 1 errors found
or file unreadable, 2 argument parsing error.
"""
import argparse
from dataclasses import dataclass, field
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

EVIDENCE_VALUES = ("observed", "inferred", "unknown")
HANDLER_ALLOWED_TAGS = {"a", "button", "input", "select", "textarea", "summary", "option", "label", "form",
                    "body", "html", "details", "dialog"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
OPTIONAL_END_TAGS = {"html", "head", "body", "p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody", "tfoot",
                     "caption", "colgroup", "option", "optgroup", "rt", "rp"}
# 5-9 main elements per view is a cognitive-load heuristic (visualization-selection.md);
# it is a prompt to consider splitting the view, so exceeding it is only a warning.
MAX_FIGURE_NODES = 9
EXTERNAL_URL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:)?//", re.IGNORECASE)
CSS_URL = re.compile(r"""(?:@import\s+(?:url\()?|url\()\s*['"]?([^'")\s]+)""", re.IGNORECASE)
SYMBOL_SEPARATORS = re.compile(r"\.|::|#|/")
# A separator followed by more text in the same text run has no <wbr> after it.
MISSING_BREAK = {"file": re.compile(r"/(?=\S)"), "symbol": re.compile(r"(?:::|\.|(?<=[A-Za-z0-9])_)(?=\S)")}
SOURCE_PARTS = {"src-file": "file", "src-symbol": "symbol"}
ABSTRACT_ARROW_LABELS = {"使用", "呼び出し", "依存", "通信", "連携", "参照", "利用"}
AMBIGUOUS_START = re.compile(r"^(?:これ|それ|この処理|その値|該当するもの|前述のもの)(?:は|が|を|に|で|も|について|、)")
PROSE_TAGS = {"p", "li"}


@dataclass
class Figure:
    line: int
    question: str
    in_first_view: bool
    has_caption: bool = False
    nodes: int = 0


@dataclass
class SvgScope:
    line: int
    depth: int
    labelled: bool


@dataclass(frozen=True)
class CodeRef:
    line: int
    file: str
    symbol: str
    target_line: str


@dataclass
class CodeMap:
    line: int
    unlabelled_cell: bool = False
    has_source: bool = False
    missing_break: bool = False


@dataclass
class OpenElement:
    tag: str
    line: int
    first_view: bool
    scrolls_horizontally: bool
    codemap: CodeMap | None = None
    source_part: str | None = None
    figure: Figure | None = None
    svg: SvgScope | None = None
    concept: str | None = None
    arrow_label: bool = False
    prose: bool = False
    text: list = field(default_factory=list)


@dataclass
class Findings:
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)

    def error(self, code, message, line=None):
        self.errors.append({"code": code, "message": message, "line": line})

    def warn(self, code, message, line=None):
        self.warnings.append({"code": code, "message": message, "line": line})


class ExplainerParser(HTMLParser):
    def __init__(self, findings):
        super().__init__(convert_charrefs=True)
        self.findings = findings
        self.ids = {}
        self.anchor_refs = []
        self.label_refs = []
        self.headings = []
        self.code_refs = []
        self.evidence = dict.fromkeys(EVIDENCE_VALUES, 0)
        self.figures = []
        self.html_lang = ""
        self.has_charset = False
        self.has_viewport = False
        self.title_text = ""
        self.in_title = False
        self.in_style = False
        self.stack = []
        self.codemaps = []
        self.concept_labels = []
        self.arrow_labels = []
        self.prose_blocks = []

    @property
    def line(self):
        return self.getpos()[0]

    def innermost(self, attribute):
        for element in reversed(self.stack):
            if getattr(element, attribute) is not None:
                return getattr(element, attribute)
        return None

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_starttag(self, tag, attrs):
        attr = {name: (value if value is not None else "") for name, value in attrs}
        classes = attr.get("class", "").split()
        if "id" in attr:
            self.ids.setdefault(attr["id"], []).append(self.line)
        self.check_resources(tag, attr)
        self.check_interaction(tag, attr)
        self.record_document_metadata(tag, attr)
        self.record_references(attr)

        figure = svg = None
        parent_figure = self.innermost("figure")
        parent_svg = self.innermost("svg")
        if tag == "figure":
            figure = Figure(self.line, attr.get("data-question", "").strip(),
                            in_first_view=any(element.first_view for element in self.stack))
            self.figures.append(figure)
        elif tag == "figcaption" and parent_figure:
            parent_figure.has_caption = True
        if "node" in classes and parent_figure:
            parent_figure.nodes += 1
        parent_codemap = self.innermost("codemap")
        if parent_codemap and tag == "td" and not attr.get("data-label", "").strip():
            parent_codemap.unlabelled_cell = True
        source_part = next((SOURCE_PARTS[name] for name in classes if name in SOURCE_PARTS), None)
        if parent_codemap and source_part == "file":
            parent_codemap.has_source = True
        if tag == "table" and not any(element.scrolls_horizontally for element in self.stack):
            self.findings.warn("table-scroll", "<table> is outside .table-wrap or <figure>; narrow screens overflow",
                               self.line)
        if tag == "svg":
            hidden = attr.get("aria-hidden") == "true"
            labelled = hidden or bool(attr.get("aria-label", "").strip()) or bool(attr.get("aria-labelledby", "").strip())
            svg = SvgScope(self.line, len(self.stack), labelled)
            if parent_figure and not parent_svg and not hidden and not attr.get("width"):
                self.findings.warn("svg-width", "<svg> in a figure has no width attribute; it shrinks on narrow screens",
                                   self.line)
        elif tag == "title" and parent_svg and len(self.stack) == parent_svg.depth + 1:
            parent_svg.labelled = True

        if tag not in VOID_TAGS:
            first_view = attr.get("id") == "what" or "first-view" in classes
            scrolls = tag == "figure" or "table-wrap" in classes
            codemap = CodeMap(self.line) if tag == "table" and "codemap" in classes else None
            if codemap:
                self.codemaps.append(codemap)
            concept = attr.get("data-concept")
            arrow_label = "arrow-label" in classes
            self.stack.append(OpenElement(tag, self.line, first_view, scrolls, codemap, source_part, figure, svg,
                                          concept, arrow_label, tag in PROSE_TAGS))
        if "data-arrow-label" in attr:
            self.arrow_labels.append((attr["data-arrow-label"].strip(), self.line))

    def record_document_metadata(self, tag, attr):
        if tag == "html":
            self.html_lang = attr.get("lang", "").strip()
        elif tag == "meta":
            if "charset" in attr or attr.get("http-equiv", "").lower() == "content-type":
                self.has_charset = True
            if attr.get("name", "").lower() == "viewport":
                self.has_viewport = True
        elif tag == "title" and not self.innermost("svg"):
            self.in_title = True
        elif tag == "style":
            self.in_style = True
        elif re.fullmatch(r"h[1-6]", tag):
            self.headings.append((int(tag[1]), self.line))
        elif tag == "img" and "alt" not in attr:
            self.findings.error("img-alt", "<img> has no alt attribute", self.line)

    def record_references(self, attr):
        href = attr.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.anchor_refs.append((href[1:], self.line))
        for name in ("aria-labelledby", "aria-describedby"):
            for ref in attr.get(name, "").split():
                self.label_refs.append((ref, name, self.line))
        if "data-evidence" in attr:
            value = attr["data-evidence"].strip()
            if value in self.evidence:
                self.evidence[value] += 1
            else:
                self.findings.error("evidence-value",
                                    f"data-evidence='{value}' must be observed, inferred or unknown", self.line)
        if "data-file" in attr:
            self.code_refs.append(CodeRef(self.line, attr["data-file"].strip(), attr.get("data-symbol", "").strip(),
                                          attr.get("data-line", "").strip()))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "style":
            self.in_style = False
        if not any(element.tag == tag for element in self.stack):
            if tag not in VOID_TAGS | OPTIONAL_END_TAGS:
                self.findings.warn("stray-end-tag", f"</{tag}> has no matching open element", self.line)
            return
        while self.stack:
            element = self.stack.pop()
            self.close_element(element)
            if element.tag == tag:
                break
            if element.tag not in OPTIONAL_END_TAGS:
                self.findings.warn("unclosed-element",
                                   f"<{element.tag}> opened on line {element.line} is closed implicitly by </{tag}>",
                                   self.line)

    def close_element(self, element):
        if element.svg and not element.svg.labelled:
            self.findings.error("svg-label",
                                '<svg> needs a <title> child, aria-label or aria-labelledby (or aria-hidden="true")',
                                element.svg.line)
        label = " ".join(" ".join(element.text).split())
        if element.concept and label:
            self.concept_labels.append((element.concept, label, element.line))
        if element.arrow_label:
            self.arrow_labels.append((label, element.line))
        if element.prose and label:
            self.prose_blocks.append((label, element.line))

    def finish(self):
        self.close()
        for element in reversed(self.stack):
            self.close_element(element)
            if element.tag not in OPTIONAL_END_TAGS:
                self.findings.warn("unclosed-element", f"<{element.tag}> opened on line {element.line} is never closed",
                                   element.line)
        self.stack.clear()

    def handle_data(self, data):
        for element in self.stack:
            if element.concept or element.arrow_label:
                element.text.append(data)
        for element in reversed(self.stack):
            if element.prose:
                element.text.append(data)
                break
        source_part = self.innermost("source_part")
        codemap = self.innermost("codemap")
        if source_part and codemap and MISSING_BREAK[source_part].search(data):
            codemap.missing_break = True
        if self.in_title:
            self.title_text += data
        if self.in_style:
            for url in CSS_URL.findall(data):
                if not url.startswith("data:"):
                    self.findings.error("external-css-url", f"stylesheet loads '{url}'; inline it or use a data: URL",
                                        self.line)

    def check_resources(self, tag, attr):
        if tag == "script" and attr.get("src") and not attr["src"].startswith("data:"):
            self.findings.error("external-script", f"<script src='{attr['src']}'> is not standalone; inline the script",
                                self.line)
        if tag == "link":
            rel = set(attr.get("rel", "").lower().split())
            href = attr.get("href", "")
            if rel & {"stylesheet", "preload", "modulepreload"} and href and not href.startswith("data:"):
                self.findings.error("external-stylesheet",
                                    f"<link rel='{attr['rel']}' href='{href}'> is not standalone; inline it", self.line)
        if tag in {"img", "source", "iframe", "embed", "object", "video", "audio"}:
            src = attr.get("src") or attr.get("data") or ""
            if src and not src.startswith("data:"):
                kind = "external" if EXTERNAL_URL.match(src) else "relative"
                self.findings.warn(f"{kind}-media", f"<{tag}> loads '{src}'; the file is not standalone", self.line)
        for url in CSS_URL.findall(attr.get("style", "")):
            if not url.startswith("data:"):
                self.findings.error("external-css-url", f"inline style loads '{url}'", self.line)

    def check_interaction(self, tag, attr):
        handlers = sorted(name for name in attr if name.startswith("on"))
        if handlers and tag not in HANDLER_ALLOWED_TAGS:
            self.findings.error("non-interactive-handler",
                                f"<{tag}> has {', '.join(handlers)}; use <button> or <a> so it works with a keyboard",
                                self.line)
        tabindex = attr.get("tabindex", "").strip()
        if tabindex.lstrip("-").isdigit() and int(tabindex) > 0:
            self.findings.warn("positive-tabindex", f"tabindex={tabindex} changes the natural focus order", self.line)


def symbol_missing_part(text, symbol):
    for part in filter(None, SYMBOL_SEPARATORS.split(symbol)):
        if not re.search(rf"(?<![\w$]){re.escape(part)}(?![\w$])", text):
            return part
    return None


def check_code_ref(ref, root, findings):
    if not ref.file:
        findings.error("code-ref-file", "data-file is empty", ref.line)
        return
    path = (root / ref.file).resolve()
    if root not in path.parents:
        findings.error("code-ref-file", f"data-file '{ref.file}' points outside --source-root", ref.line)
        return
    if not path.is_file():
        findings.error("code-ref-file", f"data-file '{ref.file}' does not exist under --source-root", ref.line)
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    missing = symbol_missing_part(text, ref.symbol)
    if missing:
        findings.error("code-ref-symbol", f"symbol '{missing}' from '{ref.symbol}' does not appear in {ref.file}",
                       ref.line)
    if ref.target_line and not (ref.target_line.isdigit()
                                and 1 <= int(ref.target_line) <= len(text.splitlines())):
        findings.error("code-ref-line", f"data-line '{ref.target_line}' is outside {ref.file}", ref.line)


def check_document(parser, findings):
    if not parser.html_lang:
        findings.error("html-lang", "<html> needs a lang attribute")
    if not parser.has_charset:
        findings.error("meta-charset", "missing <meta charset>")
    if not parser.has_viewport:
        findings.error("meta-viewport", 'missing <meta name="viewport">')
    if not parser.title_text.strip():
        findings.error("title", "missing or empty <title>")

    h1_count = sum(1 for level, _ in parser.headings if level == 1)
    if h1_count != 1:
        findings.error("h1-count", f"expected exactly one <h1>, found {h1_count}")
    previous = 0
    for level, line in parser.headings:
        if previous and level > previous + 1:
            findings.warn("heading-skip", f"heading jumps from h{previous} to h{level}", line)
        previous = level

    for element_id, lines in parser.ids.items():
        if len(lines) > 1:
            findings.error("duplicate-id",
                           f"id '{element_id}' is used {len(lines)} times (lines {', '.join(map(str, lines))})",
                           lines[1])
    for target, line in parser.anchor_refs:
        if target not in parser.ids:
            findings.error("broken-anchor", f"href '#{target}' has no matching id", line)
    for target, name, line in parser.label_refs:
        if target not in parser.ids:
            findings.error("broken-aria-ref", f"{name} '{target}' has no matching id", line)


def check_figures(figures, findings):
    for figure in figures:
        if not figure.question:
            findings.error("figure-question",
                           "<figure> needs a non-empty data-question stating the reader question it answers",
                           figure.line)
        if not figure.has_caption:
            findings.error("figure-caption", "<figure> needs a <figcaption>", figure.line)
        if figure.nodes > MAX_FIGURE_NODES:
            findings.warn("figure-density",
                          f"figure has {figure.nodes} .node elements; consider Overview -> Focused View", figure.line)
    first_view_figures = sum(figure.in_first_view for figure in figures)
    if first_view_figures > 1:
        findings.warn("first-view-figures",
                      f"first view has {first_view_figures} figures; keep one primary visualization")


def check_codemaps(codemaps, findings):
    for codemap in codemaps:
        if codemap.unlabelled_cell:
            findings.warn("codemap-label", "Code Map cells need data-label; narrow screens show them instead of the header",
                          codemap.line)
        if not codemap.has_source:
            findings.warn("codemap-source", "Code Map has no .src-file / .src-symbol source cell", codemap.line)
        if codemap.missing_break:
            findings.warn("codemap-break", "Code Map source text needs <wbr> after / in files and . :: _ in symbols",
                          codemap.line)


def check_language(parser, findings, model=None):
    for label, line in parser.arrow_labels:
        if label in ABSTRACT_ARROW_LABELS:
            findings.warn("LANG006", f"arrow label '{label}' does not say what is exchanged or done", line)

    for block, line in parser.prose_blocks:
        sentences = [part.strip() for part in re.split(r"(?<=[。！？])", block) if part.strip()]
        for sentence in sentences:
            if AMBIGUOUS_START.match(sentence):
                findings.warn("LANG003", f"possible ambiguous reference: '{sentence[:24]}'", line)
            if len(sentence) > 120 and (sentence.count("、") >= 3 or sentence.count("場合") >= 2):
                findings.warn("LANG001", "sentence may contain too many claims; review actor and conditions", line)

    if model is None:
        return
    entries = model.get("glossary", [])
    if entries and not parser.concept_labels:
        findings.warn("LANG004", "model defines terms but HTML has no data-concept labels")
    by_concept = {entry.get("concept"): entry for entry in entries if entry.get("concept")}
    owners = {}
    for concept, entry in by_concept.items():
        for term in [entry.get("preferred", ""), *entry.get("code_terms", []), *entry.get("aliases", [])]:
            if term:
                owners.setdefault(term, set()).add(concept)
    for concept, label, line in parser.concept_labels:
        entry = by_concept.get(concept)
        if entry is None:
            findings.warn("LANG004", f"data-concept '{concept}' has no glossary entry", line)
            continue
        allowed = {entry.get("preferred", ""), *entry.get("code_terms", []), *entry.get("aliases", [])}
        if label in allowed:
            continue
        if owners.get(label, set()) - {concept}:
            findings.error("LANG004", f"'{label}' is annotated as '{concept}' but names another concept", line)
        else:
            findings.warn("LANG004", f"'{label}' differs from preferred term '{entry.get('preferred', '')}'", line)


def validate(html, source_root=None, model=None):
    findings = Findings()
    parser = ExplainerParser(findings)
    parser.feed(html)
    parser.finish()

    check_document(parser, findings)
    check_figures(parser.figures, findings)
    check_codemaps(parser.codemaps, findings)
    check_language(parser, findings, model)
    if not any(parser.evidence.values()):
        findings.warn("no-evidence-markers", "no data-evidence markers; inferred and unknown claims must be marked")
    if not parser.code_refs:
        findings.warn("no-code-refs", "no data-file code references; key claims should trace to code")
    if source_root is not None:
        root = source_root.resolve()
        for ref in parser.code_refs:
            check_code_ref(ref, root, findings)

    return {
        "ok": not findings.errors,
        "errors": findings.errors,
        "warnings": findings.warnings,
        "stats": {"figures": len(parser.figures), "code_refs": len(parser.code_refs),
                  "evidence_markers": parser.evidence, "headings": len(parser.headings)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("html", type=Path, help="Explainer HTML file")
    parser.add_argument("--source-root", type=Path,
                        help="Repository root; verifies data-file / data-symbol / data-line code references")
    parser.add_argument("--model", type=Path, help="Explanation Model JSON; checks annotated concept names")
    args = parser.parse_args()
    try:
        if args.source_root is not None and not args.source_root.is_dir():
            raise ValueError(f"--source-root is not a directory: {args.source_root}")
        model = json.loads(args.model.read_text(encoding="utf-8")) if args.model else None
        if model is not None and not isinstance(model, dict):
            raise ValueError("--model must contain a JSON object")
        result = validate(args.html.read_text(encoding="utf-8"), args.source_root, model)
    except (ValueError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"file": str(args.html), **result}, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

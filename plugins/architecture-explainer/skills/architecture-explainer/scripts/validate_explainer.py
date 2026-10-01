"""Check the structure of an architecture explainer HTML file; print JSON findings.

Checks structure only: standalone dependencies, anchors, ids, headings, figure
contracts, evidence markers, simple accessibility, and (with --source-root)
that code references point at existing files and symbols. It does not judge
whether claims are true. Exit codes: 0 no errors, 1 errors found or file
unreadable, 2 argument parsing error.
"""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

EVIDENCE_VALUES = {"observed", "inferred", "unknown"}
INTERACTIVE_TAGS = {"a", "button", "input", "select", "textarea", "summary", "option", "label", "form"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
# The requester's cognitive-load heuristic is 5-9 main elements per view.
MAX_FIGURE_NODES = 9
EXTERNAL_URL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:)?//", re.IGNORECASE)
CSS_URL = re.compile(r"""(?:@import\s+(?:url\()?|url\()\s*['"]?([^'")\s]+)""", re.IGNORECASE)
SYMBOL_SEPARATORS = re.compile(r"\.|::|#|/")


class ExplainerParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.errors = []
        self.warnings = []
        self.ids = {}
        self.anchor_refs = []
        self.label_refs = []
        self.headings = []
        self.code_refs = []
        self.evidence = {value: 0 for value in EVIDENCE_VALUES}
        self.figures = []
        self.html_lang = None
        self.has_charset = False
        self.has_viewport = False
        self.title_text = None
        self.in_title = False
        self.in_style = False
        self.stack = []
        self.svgs = []

    def error(self, code, message):
        self.errors.append({"code": code, "message": message, "line": self.getpos()[0]})

    def warn(self, code, message):
        self.warnings.append({"code": code, "message": message, "line": self.getpos()[0]})

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_starttag(self, tag, attrs):
        attr = {name: (value if value is not None else "") for name, value in attrs}
        classes = attr.get("class", "").split()
        line = self.getpos()[0]

        if "id" in attr:
            self.ids.setdefault(attr["id"], []).append(line)
        self.check_resources(tag, attr)
        self.check_interaction(tag, attr)

        if tag == "html":
            self.html_lang = attr.get("lang", "").strip()
        elif tag == "meta":
            if "charset" in attr or attr.get("http-equiv", "").lower() == "content-type":
                self.has_charset = True
            if attr.get("name", "").lower() == "viewport":
                self.has_viewport = True
        elif tag == "title" and not self.svgs:
            self.in_title = True
            self.title_text = ""
        elif tag == "style":
            self.in_style = True
        elif re.fullmatch(r"h[1-6]", tag):
            self.headings.append((int(tag[1]), line))
        elif tag == "img" and "alt" not in attr:
            self.error("img-alt", "<img> has no alt attribute")

        href = attr.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.anchor_refs.append((href[1:], line))
        for name in ("aria-labelledby", "aria-describedby"):
            for ref in attr.get(name, "").split():
                self.label_refs.append((ref, name, line))

        if "data-evidence" in attr:
            value = attr["data-evidence"].strip()
            if value in EVIDENCE_VALUES:
                self.evidence[value] += 1
            else:
                self.error("evidence-value", f"data-evidence='{value}' must be observed, inferred or unknown")
        if "data-file" in attr:
            self.code_refs.append({"file": attr["data-file"].strip(), "symbol": attr.get("data-symbol", "").strip(),
                                   "line_number": attr.get("data-line", "").strip(), "line": line})

        if tag == "figure":
            self.figures.append({"line": line, "question": attr.get("data-question", "").strip(),
                                 "caption": False, "nodes": 0,
                                 "first_view": any(item["first_view"] for item in self.stack)})
        elif tag == "figcaption" and self.open_figure():
            self.open_figure()["caption"] = True
        if "node" in classes and self.open_figure():
            self.open_figure()["nodes"] += 1

        if tag == "svg":
            labelled = attr.get("aria-hidden") == "true" or bool(attr.get("aria-label", "").strip()) \
                or bool(attr.get("aria-labelledby", "").strip())
            self.svgs.append({"line": line, "labelled": labelled, "depth": len(self.stack)})
        elif tag == "title" and self.svgs and len(self.stack) == self.svgs[-1]["depth"] + 1:
            self.svgs[-1]["labelled"] = True

        if tag not in VOID_TAGS:
            first_view = attr.get("id") == "what" or "first-view" in classes
            figure = len(self.figures) - 1 if tag == "figure" else None
            self.stack.append({"tag": tag, "first_view": first_view, "figure": figure})

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "style":
            self.in_style = False
        if not any(item["tag"] == tag for item in self.stack):
            return
        while self.stack:
            item = self.stack.pop()
            if item["tag"] == "svg" and self.svgs:
                svg = self.svgs.pop()
                if not svg["labelled"]:
                    self.errors.append({"code": "svg-label", "line": svg["line"],
                                        "message": "<svg> needs a <title> child, aria-label or aria-labelledby (or aria-hidden=\"true\")"})
            if item["tag"] == tag:
                break

    def handle_data(self, data):
        if self.in_title:
            self.title_text += data
        if self.in_style:
            for url in CSS_URL.findall(data):
                if not url.startswith("data:"):
                    self.error("external-css-url", f"stylesheet loads '{url}'; inline it or use a data: URL")

    def open_figure(self):
        for item in reversed(self.stack):
            if item["figure"] is not None:
                return self.figures[item["figure"]]
        return None

    def check_resources(self, tag, attr):
        if tag == "script" and attr.get("src") and not attr["src"].startswith("data:"):
            self.error("external-script", f"<script src='{attr['src']}'> is not standalone; inline the script")
        if tag == "link":
            rel = attr.get("rel", "").lower().split()
            href = attr.get("href", "")
            if ({"stylesheet", "preload", "modulepreload"} & set(rel)) and href and not href.startswith("data:"):
                self.error("external-stylesheet", f"<link rel='{attr['rel']}' href='{href}'> is not standalone; inline it")
        if tag in {"img", "source", "iframe", "embed", "object", "video", "audio"}:
            src = attr.get("src") or attr.get("data") or ""
            if src and not src.startswith("data:"):
                kind = "external" if EXTERNAL_URL.match(src) else "relative"
                self.warn(f"{kind}-media", f"<{tag}> loads '{src}'; the file is not standalone")
        for url in CSS_URL.findall(attr.get("style", "")):
            if not url.startswith("data:"):
                self.error("external-css-url", f"inline style loads '{url}'")

    def check_interaction(self, tag, attr):
        handlers = sorted(name for name in attr if name.startswith("on"))
        if handlers and tag not in INTERACTIVE_TAGS | {"body", "html", "details", "dialog"}:
            self.error("non-interactive-handler",
                       f"<{tag}> has {', '.join(handlers)}; use <button> or <a> so it works with a keyboard")
        tabindex = attr.get("tabindex", "").strip()
        if tabindex.lstrip("-").isdigit() and int(tabindex) > 0:
            self.warn("positive-tabindex", f"tabindex={tabindex} changes the natural focus order")


def symbol_found(text, symbol):
    for part in filter(None, SYMBOL_SEPARATORS.split(symbol)):
        if not re.search(rf"(?<![\w$]){re.escape(part)}(?![\w$])", text):
            return False, part
    return True, None


def check_code_refs(parser, source_root):
    root = source_root.resolve()
    for ref in parser.code_refs:
        def fail(code, message):
            parser.errors.append({"code": code, "message": message, "line": ref["line"]})

        if not ref["file"]:
            fail("code-ref-file", "data-file is empty")
            continue
        path = (root / ref["file"]).resolve()
        if root not in path.parents and path != root:
            fail("code-ref-file", f"data-file '{ref['file']}' points outside --source-root")
            continue
        if not path.is_file():
            fail("code-ref-file", f"data-file '{ref['file']}' does not exist under --source-root")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if ref["symbol"]:
            found, part = symbol_found(text, ref["symbol"])
            if not found:
                fail("code-ref-symbol", f"symbol '{part}' from '{ref['symbol']}' does not appear in {ref['file']}")
        if ref["line_number"]:
            if not ref["line_number"].isdigit() or not 1 <= int(ref["line_number"]) <= len(text.splitlines()):
                fail("code-ref-line", f"data-line '{ref['line_number']}' is outside {ref['file']}")


def validate(html, source_root=None):
    parser = ExplainerParser()
    parser.feed(html)
    parser.close()

    def document_error(code, message):
        parser.errors.append({"code": code, "message": message, "line": None})

    if not parser.html_lang:
        document_error("html-lang", "<html> needs a lang attribute")
    if not parser.has_charset:
        document_error("meta-charset", "missing <meta charset>")
    if not parser.has_viewport:
        document_error("meta-viewport", "missing <meta name=\"viewport\">")
    if not (parser.title_text or "").strip():
        document_error("title", "missing or empty <title>")

    h1_count = sum(1 for level, _ in parser.headings if level == 1)
    if h1_count != 1:
        document_error("h1-count", f"expected exactly one <h1>, found {h1_count}")
    previous = 0
    for level, line in parser.headings:
        if previous and level > previous + 1:
            parser.warnings.append({"code": "heading-skip", "line": line,
                                    "message": f"heading jumps from h{previous} to h{level}"})
        previous = level

    for element_id, lines in parser.ids.items():
        if len(lines) > 1:
            parser.errors.append({"code": "duplicate-id", "line": lines[1],
                                  "message": f"id '{element_id}' is used {len(lines)} times (lines {', '.join(map(str, lines))})"})
    for target, line in parser.anchor_refs:
        if target not in parser.ids:
            parser.errors.append({"code": "broken-anchor", "line": line, "message": f"href '#{target}' has no matching id"})
    for target, name, line in parser.label_refs:
        if target not in parser.ids:
            parser.errors.append({"code": "broken-aria-ref", "line": line, "message": f"{name} '{target}' has no matching id"})

    first_view_figures = 0
    for figure in parser.figures:
        if not figure["question"]:
            parser.errors.append({"code": "figure-question", "line": figure["line"],
                                  "message": "<figure> needs a non-empty data-question stating the reader question it answers"})
        if not figure["caption"]:
            parser.errors.append({"code": "figure-caption", "line": figure["line"], "message": "<figure> needs a <figcaption>"})
        if figure["nodes"] > MAX_FIGURE_NODES:
            parser.warnings.append({"code": "figure-density", "line": figure["line"],
                                    "message": f"figure has {figure['nodes']} .node elements; consider Overview -> Focused View"})
        first_view_figures += figure["first_view"]
    if first_view_figures > 1:
        parser.warnings.append({"code": "first-view-figures", "line": None,
                                "message": f"first view has {first_view_figures} figures; keep one primary visualization"})

    if not any(parser.evidence.values()):
        parser.warnings.append({"code": "no-evidence-markers", "line": None,
                                "message": "no data-evidence markers; inferred and unknown claims must be marked"})
    if not parser.code_refs:
        parser.warnings.append({"code": "no-code-refs", "line": None,
                                "message": "no data-file code references; key claims should trace to code"})
    if source_root is not None:
        check_code_refs(parser, source_root)

    return {
        "ok": not parser.errors,
        "errors": parser.errors,
        "warnings": parser.warnings,
        "stats": {"figures": len(parser.figures), "code_refs": len(parser.code_refs),
                  "evidence_markers": parser.evidence, "headings": len(parser.headings)},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("html", type=Path, help="Explainer HTML file")
    parser.add_argument("--source-root", type=Path,
                        help="Repository root; verifies data-file / data-symbol / data-line code references")
    args = parser.parse_args()
    try:
        if args.source_root is not None and not args.source_root.is_dir():
            raise ValueError(f"--source-root is not a directory: {args.source_root}")
        result = validate(args.html.read_text(encoding="utf-8"), args.source_root)
    except (ValueError, OSError, UnicodeDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"file": str(args.html), **result}, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

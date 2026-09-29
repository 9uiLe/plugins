#!/usr/bin/env python3
"""Check structural and self-contained requirements of a mental-model HTML file."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class Audit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.errors: list[str] = []
        self.ids: set[str] = set()
        self.headings: list[int] = []
        self.main_count = 0
        self.h1_count = 0
        self.has_lang = False
        self.has_viewport = False
        self.title = ""
        self.in_title = False
        self.in_style = False
        self.css: list[str] = []
        self.details_depth = 0
        self.details_with_summary: list[bool] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "html":
            self.has_lang = bool(values.get("lang"))
        elif tag == "meta" and (values.get("name") or "").lower() == "viewport":
            self.has_viewport = bool(values.get("content"))
        elif tag == "main":
            self.main_count += 1
        elif tag == "title":
            self.in_title = True
        elif tag == "style":
            self.in_style = True
        elif re.fullmatch(r"h[1-6]", tag):
            level = int(tag[1])
            self.headings.append(level)
            self.h1_count += level == 1
        elif tag == "details":
            self.details_depth += 1
            self.details_with_summary.append(False)
        elif tag == "summary" and self.details_depth:
            self.details_with_summary[-1] = True

        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.errors.append(f"duplicate id: {element_id}")
            self.ids.add(element_id)

        if tag == "script" and values.get("src"):
            self.errors.append("external script dependency")
        if tag == "link" and "stylesheet" in (values.get("rel") or "").lower():
            self.errors.append("external stylesheet dependency")
        if tag in {"iframe", "object", "embed"}:
            self.errors.append(f"embedded external resource: <{tag}>")
        if tag in {"img", "source", "audio", "video"}:
            for attr in ("src", "srcset", "poster"):
                value = values.get(attr)
                if value and not value.startswith("data:"):
                    self.errors.append(f"non-embedded {tag} {attr}: {value}")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        elif tag == "style":
            self.in_style = False
        elif tag == "details" and self.details_depth:
            if not self.details_with_summary.pop():
                self.errors.append("<details> without <summary>")
            self.details_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title += data
        if self.in_style:
            self.css.append(data)


def audit(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8")
    parser = Audit()
    parser.feed(raw)
    parser.close()
    errors = parser.errors
    if not re.match(r"\s*<!doctype html\s*>", raw, re.IGNORECASE):
        errors.append("missing <!doctype html>")
    if not parser.has_lang:
        errors.append("missing html lang")
    if not parser.has_viewport:
        errors.append("missing viewport meta")
    if not parser.title.strip():
        errors.append("missing document title")
    if parser.main_count != 1:
        errors.append(f"expected one <main>, found {parser.main_count}")
    if parser.h1_count != 1:
        errors.append(f"expected one <h1>, found {parser.h1_count}")
    for previous, current in zip(parser.headings, parser.headings[1:]):
        if current > previous + 1:
            errors.append(f"heading level skips from h{previous} to h{current}")
    css = "\n".join(parser.css)
    if re.search(r"@import\b", css, re.IGNORECASE):
        errors.append("CSS @import dependency")
    for value in re.findall(r"url\(\s*['\"]?([^)'\"]+)", css, re.IGNORECASE):
        if not value.strip().startswith(("data:", "#")):
            errors.append(f"non-embedded CSS url: {value.strip()}")
    return errors


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("html", type=Path)
    args = cli.parse_args()
    try:
        errors = audit(args.html)
    except (OSError, UnicodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"OK: {args.html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Boundary invariants and canonical model round trips."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from analysis_json import parse_analysis_json
from canonicalizer import canonicalize
from domain import CodeLens, CodeLine, CodeRange, LineNumber, SourceLocation, SourcePath
from model_json import ModelDocument, ModelHeader, parse_model_json, serialize_model_json
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "checkout"


def checkout_json() -> str:
    analysis = parse_analysis_json((FIXTURE / "analysis.json").read_text(encoding="utf-8"))
    contents = {SourcePath(name): (FIXTURE / "input" / name).read_text(encoding="utf-8")
                for name in ("service.py", "test_service.py")}
    model = canonicalize(analysis, contents)
    return serialize_model_json(ModelDocument(ModelHeader(SCHEMA_VERSION, RENDERER_VERSION,
                                                         SKILL_VERSION, "ja-JP"), model))


class DomainModelTests(unittest.TestCase):
    def test_source_location_rejects_escaping_path_and_invalid_range(self) -> None:
        for path, start, end in (("../secret.py", 1, 1), ("/tmp/file.py", 1, 1),
                                 ("service.py", 0, 1), ("service.py", 3, 2)):
            with self.subTest(path=path, start=start, end=end):
                with self.assertRaises(ValueError):
                    SourceLocation(SourcePath(path), LineNumber(start), LineNumber(end))

    def test_code_lens_requires_contiguous_lines_and_contained_focus(self) -> None:
        displayed = CodeRange(SourcePath("service.py"), LineNumber(1), LineNumber(3))
        focus = SourceLocation(SourcePath("service.py"), LineNumber(2), LineNumber(2))
        lines = (CodeLine(LineNumber(1), "a"), CodeLine(LineNumber(3), "c"))
        with self.assertRaises(ValueError):
            CodeLens(displayed, focus, lines)
        with self.assertRaises(ValueError):
            CodeLens(displayed, SourceLocation(SourcePath("other.py"), LineNumber(2), LineNumber(2)),
                     (CodeLine(LineNumber(1), "a"), CodeLine(LineNumber(2), "b"),
                      CodeLine(LineNumber(3), "c")))

    def test_checkout_json_round_trip_preserves_canonical_bytes(self) -> None:
        original = checkout_json()
        self.assertEqual(serialize_model_json(parse_model_json(original)), original)

    def test_canonical_json_rejects_dangling_edges_and_zero_steps(self) -> None:
        raw = json.loads(checkout_json())
        raw["edges"][0]["to"] = "missing"
        with self.assertRaisesRegex(ValueError, "dangling"):
            parse_model_json(json.dumps(raw))
        raw = json.loads(checkout_json())
        raw["edges"][0]["execution"]["first"] = 0
        with self.assertRaisesRegex(ValueError, "positive"):
            parse_model_json(json.dumps(raw))


if __name__ == "__main__":
    unittest.main()

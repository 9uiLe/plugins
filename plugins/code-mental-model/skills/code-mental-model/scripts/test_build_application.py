#!/usr/bin/env python3
"""Cache reuse and provenance decisions with no filesystem access."""

from __future__ import annotations

import unittest
from dataclasses import replace
from pathlib import Path

from analysis_json import parse_analysis_json
from artifact_metadata import BuildInputs, TargetDigest
from build_application import build_mental_model
from domain import SourcePath
from model_json import ModelHeader, serialize_model_json
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "checkout"


class BuildApplicationTests(unittest.TestCase):
    def test_matching_inputs_reuse_model_and_changed_assets_require_analysis(self) -> None:
        analysis = parse_analysis_json((FIXTURE / "analysis.json").read_text(encoding="utf-8"))
        contents = {SourcePath(name): (FIXTURE / "input" / name).read_text(encoding="utf-8")
                    for name in ("service.py", "test_service.py")}
        inputs = BuildInputs(ModelHeader(SCHEMA_VERSION, RENDERER_VERSION, SKILL_VERSION, "ja-JP"),
                             "revision", "base", "head",
                             (TargetDigest(SourcePath("service.py"), "source-digest"),),
                             {}, {"renderer": "asset-digest"})
        built = build_mental_model(inputs, analysis, contents)
        model_json = serialize_model_json(built.document)
        reused = build_mental_model(inputs, None, contents, built.metadata, model_json)
        self.assertTrue(reused.reused)
        self.assertEqual(reused.document, built.document)
        changed = replace(inputs, assets={"renderer": "changed"})
        with self.assertRaisesRegex(ValueError, "input changed"):
            build_mental_model(changed, None, contents, built.metadata, model_json)
        with self.assertRaisesRegex(ValueError, "differs from metadata"):
            build_mental_model(inputs, None, contents, built.metadata, model_json + " ")


if __name__ == "__main__":
    unittest.main()

"""Visible evidence must describe the selected item and the whole model separately."""

from __future__ import annotations

import unittest
from pathlib import Path

from canonical import normalize
from generate_application import generate_artifact
from infrastructure import read_html_assets
from model_json import parse_model_json
from render_html import render
from test_graph_variants import CONTENTS, catalog_draft
from versions import RENDERER_VERSION, SCHEMA_VERSION, SKILL_VERSION


class PresentationEvidenceTests(unittest.TestCase):
    def test_selected_evidence_precedes_code_and_summary_counts_whole_model(self) -> None:
        versions = {"schemaVersion": SCHEMA_VERSION, "rendererVersion": RENDERER_VERSION,
                    "skillVersion": SKILL_VERSION}
        model = normalize(catalog_draft(), CONTENTS, versions, "en-US")
        output = render(model).decode("utf-8")
        detail = output.split("<h3>Catalog VM</h3>", 1)[1].split("</article>", 1)[0]
        self.assertLess(detail.index('class="meaning"'), detail.index('class="detail-evidence"'))
        self.assertLess(detail.index('class="detail-evidence"'), detail.index('class="code-lens"'))
        self.assertIn("Confirmed", detail)
        self.assertIn("catalog.py:2–3", detail)
        self.assertIn("Source locations: 2/6", output)
        self.assertIn("Inferred: 1 node, 1 connection", output)
        self.assertIn("Unknown: 0 nodes, 0 connections", output)
        summary = output.split('<section id="evidence"', 1)[1].split('</section>', 1)[0]
        self.assertIn("Inferred items", summary)
        self.assertIn("Catalog API", summary)
        self.assertIn("items &lt;ready&gt;", summary)
        self.assertNotIn("Select an object or connection for its source location", output)

    def test_checkout_unknowns_are_listed_in_global_summary(self) -> None:
        skill = Path(__file__).resolve().parent.parent
        document = parse_model_json((skill / "fixtures" / "checkout" / ".mental-model" /
                                     "mental-model.json").read_text(encoding="utf-8"))
        output = generate_artifact(document, read_html_assets(skill)).decode("utf-8")
        caller = output.split("<h3>Caller</h3>", 1)[1].split("</article>", 1)[0]
        self.assertIn("未確認", caller)
        self.assertIn("出典位置未確認", caller)
        summary = output.split('<section id="evidence"', 1)[1].split('</section>', 1)[0]
        self.assertIn("未確認の対象", summary)
        self.assertIn("<li>Caller</li>", summary)
        self.assertIn("<li>Gateway</li>", summary)


if __name__ == "__main__":
    unittest.main()

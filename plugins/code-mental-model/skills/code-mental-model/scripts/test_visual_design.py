"""Guard the page hierarchy and text contrast of the generated artifact."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

from canonical import normalize
from render_html import render
from test_graph_variants import CONTENTS, VERSIONS, catalog_draft


CSS = Path(__file__).resolve().parent.parent / "assets" / "mental-model.css"


def luminance(hex_color: str) -> float:
    channels = (int(hex_color[start:start + 2], 16) / 255 for start in (1, 3, 5))
    linear = (value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
              for value in channels)
    return sum(value * weight for value, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(first: str, second: str) -> float:
    bright, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (bright + 0.05) / (dark + 0.05)


def composite(foreground: str, background: str, opacity: float) -> str:
    channels = (round(int(foreground[index:index + 2], 16) * opacity +
                      int(background[index:index + 2], 16) * (1 - opacity))
                for index in (1, 3, 5))
    return "#" + "".join(f"{channel:02x}" for channel in channels)


class VisualDesignTests(unittest.TestCase):
    def test_text_and_graph_colors_meet_normal_text_contrast(self) -> None:
        tokens = dict(re.findall(r"--([a-z-]+):\s*(#[0-9a-f]{6})", CSS.read_text(encoding="utf-8")))
        pairs = (
            ("text-primary", "surface-page"),
            ("text-primary", "surface-card"),
            ("text-primary", "surface-map"),
            ("text-secondary", "surface-page"),
            ("text-secondary", "surface-card"),
            ("text-secondary", "surface-subtle"),
            ("text-tertiary", "surface-page"),
            ("accent-primary", "surface-card"),
            ("surface-card", "accent-primary"),
            ("status-added", "status-added-soft"),
            ("status-changed", "status-changed-soft"),
            ("status-removed", "status-removed-soft"),
            ("edge-default", "surface-map"),
        )
        for foreground, background in pairs:
            with self.subTest(foreground=foreground, background=background):
                self.assertGreaterEqual(contrast(tokens[foreground], tokens[background]), 4.5)
        css = CSS.read_text(encoding="utf-8")
        opacity_match = re.search(r"\.graph-link\.is-muted\s*\{\s*opacity:\s*([\d.]+)", css)
        self.assertIsNotNone(opacity_match)
        if opacity_match is None:
            self.fail("muted opacity is required")
        muted_role = composite(tokens["text-secondary"], tokens["surface-map"], float(opacity_match[1]))
        self.assertGreaterEqual(contrast(muted_role, tokens["surface-map"]), 4.5)

    def test_main_insight_precedes_map_and_evidence_summary(self) -> None:
        html = render(normalize(catalog_draft(), CONTENTS, VERSIONS, "en-US")).decode("utf-8")
        self.assertLess(html.index('<p class="summary">'), html.index('<section id="mental-map"'))
        self.assertLess(html.index('<section id="mental-map"'), html.index('<section id="evidence"'))
        self.assertIn('>Relationship map</h2>', html)
        self.assertIn('>Selected item</h2>', html)


if __name__ == "__main__":
    unittest.main()

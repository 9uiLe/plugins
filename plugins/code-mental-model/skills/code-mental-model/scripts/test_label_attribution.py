#!/usr/bin/env python3
"""Labels stay visibly attached to the edge they describe."""

from __future__ import annotations

import unittest
from math import hypot
from pathlib import Path

from domain import EdgeId
from artifact_metadata import canonical_json
from canonical import normalize
from generate_application import generate_artifact
from infrastructure import read_html_assets
from layout_engine import best_layout
from layout_model import GraphLayout, Point
from model_json import parse_model_json
from readability import segment_hits_box, segments
from test_graph_variants import CONTENTS, VERSIONS, catalog_draft


FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "checkout" / ".mental-model" / "mental-model.json"


def distance_to_route(point: Point, route: tuple[Point, ...]) -> float:
    distances: list[float] = []
    for start, end in zip(route, route[1:]):
        dx, dy = end[0] - start[0], end[1] - start[1]
        length_squared = dx * dx + dy * dy
        fraction = max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy)
                                 / length_squared)) if length_squared else 0.0
        distances.append(hypot(point[0] - start[0] - fraction * dx,
                               point[1] - start[1] - fraction * dy))
    return min(distances)


def unattached_labels(layout: GraphLayout) -> tuple[EdgeId, ...]:
    unattached: list[EdgeId] = []
    for edge_id, label in layout.labels.items():
        point = (label.x, label.y)
        own_distance = distance_to_route(point, layout.routes[edge_id])
        other_distance = min((distance_to_route(point, route)
                              for other_id, route in layout.routes.items() if other_id != edge_id),
                             default=float("inf"))
        box_touches_edge = any(segment_hits_box(a, b, label.box) for a, b in segments(list(layout.routes[edge_id])))
        has_leader = label.show_leader
        if ((own_distance > 20 or own_distance > other_distance) and not (box_touches_edge or has_leader)):
            unattached.append(edge_id)
        if distance_to_route(label.anchor, layout.routes[edge_id]) > 1:
            unattached.append(edge_id)
        if not (label.box.x0 - 1 <= label.attachment[0] <= label.box.x1 + 1
                and label.box.y0 - 1 <= label.attachment[1] <= label.box.y1 + 1):
            unattached.append(edge_id)
    return tuple(unattached)


class LabelAttributionTests(unittest.TestCase):
    def test_checkout_map_stays_compact_without_label_chrome(self) -> None:
        document = parse_model_json(FIXTURE.read_text(encoding="utf-8"))
        layout = best_layout(document.model)
        html = generate_artifact(document, read_html_assets(FIXTURE.parents[3])).decode("utf-8")
        desktop = html.split('<svg class="graph graph-desktop"', 1)[1].split("</svg>", 1)[0]
        self.assertLessEqual(layout.height, 800)
        self.assertEqual(desktop.count('class="label-badge"'), 0)
        self.assertLessEqual(desktop.count('class="label-leader"'), 2)
        mobile_layout = best_layout(document.model, True)
        mobile = html.split('<svg class="graph graph-mobile"', 1)[1].split("</svg>", 1)[0]
        self.assertLessEqual(mobile_layout.height, 800)
        self.assertEqual(mobile.count('class="label-badge"'), 0)
        self.assertLessEqual(mobile.count('class="label-leader"'), 2)

    def test_checkout_labels_have_a_visible_connection_to_their_own_edge(self) -> None:
        document = parse_model_json(FIXTURE.read_text(encoding="utf-8"))
        model = document.model
        html = generate_artifact(document, read_html_assets(FIXTURE.parents[3])).decode("utf-8")
        for mobile in (False, True):
            with self.subTest(mobile=mobile):
                layout = best_layout(model, mobile)
                self.assertEqual(unattached_labels(layout), ())
                surface = "mobile" if mobile else "desktop"
                svg = html.split(f'<svg class="graph graph-{surface}"', 1)[1].split("</svg>", 1)[0]
                self.assertEqual(svg.count('class="label-badge"'), 0)
                self.assertEqual(svg.count('class="label-leader"'),
                                 sum(label.show_leader for label in layout.edge_labels))
                self.assertEqual(svg.count('class="label-leader-halo"'),
                                 sum(label.show_leader for label in layout.edge_labels))

    def test_reciprocal_catalog_labels_remain_attached(self) -> None:
        model = parse_model_json(canonical_json(normalize(catalog_draft(), CONTENTS, VERSIONS, "en-US"))).model
        for mobile in (False, True):
            with self.subTest(mobile=mobile):
                self.assertEqual(unattached_labels(best_layout(model, mobile)), ())


if __name__ == "__main__":
    unittest.main()

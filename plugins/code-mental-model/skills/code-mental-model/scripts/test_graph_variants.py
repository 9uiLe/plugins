#!/usr/bin/env python3
"""Characterize canonical output and routing for a small catalog interaction."""

from __future__ import annotations

import copy
import hashlib
import unittest
from collections.abc import Callable
from typing import TypedDict

from artifact_metadata import canonical_json
from canonical import normalize, validate_model
from domain import EdgeKind, ExecutionScenario, NodeId
from layout_engine import best_layout
from model_json import parse_model_json
from render_html import render
from verify_graph_readability import readability_report, verify
from versions import SCHEMA_VERSION, RENDERER_VERSION, SKILL_VERSION


VERSIONS = {"schemaVersion": SCHEMA_VERSION, "rendererVersion": RENDERER_VERSION,
            "skillVersion": SKILL_VERSION}
CONTENTS = {"catalog.py": "class Catalog:\n    def fetch(self):\n        return []\n"}


class Draft(TypedDict):
    title: str
    nodes: list[dict[str, object]]
    edges: list[dict[str, object]]


def catalog_draft() -> Draft:
    return {
        "title": " Cafe\u0301 <catalog> ",
        "nodes": [
            {"key": "api", "label": "Catalog API", "kind": "external-system", "layer": "external",
             "status": "inferred", "state": "external", "roleCode": "side-effect-boundary"},
            {"key": "browser", "label": "Browser", "kind": "ui", "layer": "entry",
             "status": "confirmed", "roleCode": "entry"},
            {"key": "vm", "label": "Catalog VM", "kind": "view-model", "layer": "application",
             "status": "confirmed", "state": "owned", "roleCode": "coordinator",
             "source": {"path": "catalog.py", "startLine": 2, "endLine": 3}},
        ],
        "edges": [
            {"from": "api", "to": "vm", "kind": "returns", "label": "items <ready>",
             "change": "existing", "status": "inferred", "execution": {"repeat": 3, "first": 3}},
            {"from": "vm", "to": "api", "kind": "fetches", "label": "fetch()",
             "change": "added", "status": "confirmed", "condition": "on-miss",
             "execution": {"repeat": 2, "first": 2},
             "source": {"path": "catalog.py", "startLine": 2, "endLine": 2}},
            {"from": "browser", "to": "vm", "kind": "calls", "label": "open()",
             "change": "existing", "status": "confirmed", "execution": {"first": 1, "repeat": 1}},
        ],
    }


class GraphVariantTests(unittest.TestCase):
    def test_catalog_canonical_json_and_html_are_order_independent(self) -> None:
        draft = catalog_draft()
        model = normalize(draft, CONTENTS, VERSIONS, "en-US")
        reordered = copy.deepcopy(draft)
        reordered["nodes"].reverse()
        reordered["edges"].reverse()
        reordered["edges"][1]["execution"] = {"first": 2, "repeat": 2}
        other = normalize(reordered, CONTENTS, VERSIONS, "en-US")

        validate_model(model)
        typed = parse_model_json(canonical_json(model)).model
        self.assertEqual(model, other)
        self.assertEqual(typed.title, "Café <catalog>")
        self.assertEqual(typed.scenarios, (ExecutionScenario("first"), ExecutionScenario("repeat")))
        self.assertIsNotNone(typed.nodes[1].code_lens)
        if typed.nodes[1].code_lens is None:
            self.fail("Catalog VM must have a Code Lens")
        self.assertEqual(typed.nodes[1].code_lens.focus_start, 2)
        canonical = canonical_json(model).encode("utf-8")
        html = render(model)
        self.assertEqual(canonical, canonical_json(other).encode("utf-8"))
        self.assertEqual(html, render(other))
        self.assertIn(b"Caf\xc3\xa9 &lt;catalog&gt;", html)
        self.assertIn(b"items &lt;ready&gt;", html)
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), "acb609eb384de0fd2c18fedddb3d7062f846dd20d6d5d388176767533688bb30")
        self.assertEqual(hashlib.sha256(html).hexdigest(), "4813738a691b2e521d95939e562f839958dafc72e22e86364f73daf83d9fd59a")

    def test_reciprocal_edges_have_separate_lanes_on_both_maps(self) -> None:
        model = parse_model_json(canonical_json(normalize(catalog_draft(), CONTENTS, VERSIONS, "en-US"))).model
        for mobile in (False, True):
            with self.subTest(mobile=mobile):
                layout = best_layout(model, mobile)
                forward = next(edge for edge in model.edges if edge.kind == EdgeKind.FETCHES)
                reverse = next(edge for edge in model.edges if edge.kind == EdgeKind.RETURNS)
                self.assertNotEqual(layout.routes[forward.id], list(reversed(layout.routes[reverse.id])))
                self.assertEqual(layout.metrics["maxParallelEdges"], 2)
                self.assertGreaterEqual(layout.metrics["minParallelEdgeSpacing"], 20)
        verify(readability_report(model))

    def test_same_layer_event_peers_render_without_source_evidence(self) -> None:
        draft = {
            "title": "Peer events",
            "nodes": [
                {"key": "publisher", "label": "Publisher", "kind": "service", "layer": "application", "status": "confirmed"},
                {"key": "subscriber", "label": "Subscriber", "kind": "service", "layer": "application", "status": "confirmed"},
            ],
            "edges": [
                {"from": "publisher", "to": "subscriber", "kind": "emits", "label": "event",
                 "change": "existing", "status": "confirmed"},
                {"from": "subscriber", "to": "publisher", "kind": "observes", "label": "ack",
                 "change": "existing", "status": "confirmed"},
            ],
        }
        raw_model = normalize(draft, {}, VERSIONS, "ja-JP")
        model = parse_model_json(canonical_json(raw_model)).model
        verify(readability_report(model))
        for mobile in (False, True):
            layout = best_layout(model, mobile)
            self.assertEqual(layout.coords[NodeId("publisher")][1], layout.coords[NodeId("subscriber")][1])
            self.assertEqual(layout.metrics["reciprocalAmbiguity"], 0)
            self.assertEqual(layout.metrics["minParallelEdgeSpacing"], 24)
        html = render(raw_model).decode("utf-8")
        self.assertIn("対応コードは未確認です。", html)
        self.assertIn("発行します", html)
        self.assertIn("監視します", html)
        self.assertNotIn('data-mode="execution"', html)
        self.assertIn('data-scenario=""', html)

    def test_custom_scenario_is_initial_and_keeps_punctuation(self) -> None:
        draft = catalog_draft()
        name = "Phase 1: alpha, beta"
        for edge in draft["edges"]:
            original = edge["execution"]
            if not isinstance(original, dict):
                self.fail("catalog edges must have execution steps")
            edge["execution"] = {name: original["first"]}
        html = render(normalize(draft, CONTENTS, VERSIONS, "en-US")).decode("utf-8")
        self.assertIn('data-scenario="Phase 1: alpha, beta"', html)
        self.assertIn('data-execution="{&quot;Phase 1: alpha, beta&quot;:', html)
        self.assertIn('data-mode="execution"', html)

    def test_long_decision_edges_route_around_intermediate_nodes(self) -> None:
        draft = {
            "title": "Feature rollout decision",
            "nodes": [
                {"key": "registry", "label": "KmpFeatureID", "kind": "value", "layer": "entry", "roleCode": "entry", "status": "confirmed"},
                {"key": "selector", "label": "KmpImplementationSelector", "kind": "service", "layer": "application", "roleCode": "coordinator", "status": "confirmed"},
                {"key": "override", "label": "Debug override", "kind": "storage", "layer": "data", "roleCode": "state-holder", "status": "confirmed"},
                {"key": "karte", "label": "KARTE", "kind": "external-system", "layer": "external", "roleCode": "side-effect-boundary", "status": "confirmed"},
                {"key": "native", "label": "Native decision", "kind": "value", "layer": "value", "roleCode": "data-value", "status": "confirmed"},
                {"key": "kmp", "label": "KMP decision", "kind": "value", "layer": "value", "roleCode": "data-value", "status": "confirmed"},
            ],
            "edges": [
                {"from": "registry", "to": "selector", "kind": "returns", "label": "internalOnly", "change": "existing", "status": "confirmed"},
                {"from": "registry", "to": "selector", "kind": "returns", "label": "karteKey", "change": "existing", "status": "confirmed"},
                {"from": "override", "to": "selector", "kind": "returns", "label": "auto", "change": "existing", "status": "confirmed"},
                {"from": "selector", "to": "karte", "kind": "calls", "label": "flag(key)", "change": "existing", "status": "confirmed"},
                {"from": "karte", "to": "selector", "kind": "returns", "label": "true", "change": "existing", "status": "confirmed"},
                {"from": "selector", "to": "native", "kind": "returns", "label": "native", "change": "existing", "status": "confirmed"},
                {"from": "selector", "to": "kmp", "kind": "returns", "label": "kmp", "change": "existing", "status": "confirmed"},
            ],
        }
        model = parse_model_json(canonical_json(normalize(draft, {}, VERSIONS, "ja-JP"))).model
        for mobile in (False, True):
            with self.subTest(mobile=mobile):
                layout = best_layout(model, mobile)
                self.assertIn("clearance", layout.candidate)
                self.assertEqual(layout.metrics["nodeEdgeCollisions"], 0)
                self.assertEqual(layout.metrics["edgeOverlaps"], 0)
                self.assertEqual(layout.metrics["labelCollisions"], 0)
        verify(readability_report(model))

    def test_invalid_graph_inputs_are_rejected_before_rendering(self) -> None:
        cases: tuple[tuple[str, Callable[[Draft], None], str], ...] = (
            ("dangling endpoint", lambda draft: draft["edges"][0].update(to="missing"), "edge endpoint"),
            ("source outside targets", lambda draft: draft["nodes"][2].update(
                source={"path": "other.py", "startLine": 1, "endLine": 1}), "source not listed"),
            ("source range too long", lambda draft: draft["nodes"][2].update(
                source={"path": "catalog.py", "startLine": 1, "endLine": 26}), "invalid source line range"),
            ("zero execution step", lambda draft: draft["edges"][0].update(execution={"first": 0}), "execution must map"),
        )
        for name, mutate, message in cases:
            with self.subTest(name=name):
                draft = catalog_draft()
                mutate(draft)
                with self.assertRaisesRegex(ValueError, message):
                    normalize(draft, CONTENTS, VERSIONS, "en-US")


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""Check deterministic readability metrics against collision invariants and a golden baseline."""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path

from domain import MentalModel
from infrastructure import read_json_object
from layout_engine import best_layout
from model_json import parse_model_json

SurfaceMetrics = dict[str, float | str]
ReadabilityReport = dict[str, SurfaceMetrics]

ZERO_REQUIRED = ("nodeOverlaps", "nodeLabelCollisions", "nodeEdgeCollisions",
                 "labelCollisions", "edgeLabelCollisions", "edgeOverlaps",
                 "reciprocalAmbiguity", "unlabeledImportantEdges", "outOfBounds")


def readability_report(model: MentalModel) -> ReadabilityReport:
    layouts = (("desktop", best_layout(model)), ("mobile", best_layout(model, True)))
    return {name: {"candidate": layout.candidate, "width": layout.width,
                   "height": layout.height, **dict(layout.metrics.items())}
            for name, layout in layouts}


def report(model: object) -> ReadabilityReport:
    document = parse_model_json(json.dumps(model, ensure_ascii=False))
    return readability_report(document.model)


def _number(metrics: Mapping[str, float | str], key: str) -> float:
    value = metrics[key]
    if isinstance(value, str):
        raise ValueError(f"readability metric must be numeric: {key}")
    return value


def verify(actual: Mapping[str, Mapping[str, float | str]],
           expected: Mapping[str, Mapping[str, float | str]] | None = None) -> None:
    for surface, metrics in actual.items():
        for key in ZERO_REQUIRED:
            if _number(metrics, key):
                raise ValueError(f"{surface}: {key}={metrics[key]}; expected 0")
        if (_number(metrics, "maxParallelEdges") > 1
                and _number(metrics, "minParallelEdgeSpacing") < 20):
            raise ValueError(f"{surface}: parallel edge spacing {metrics['minParallelEdgeSpacing']} < 20")
        if expected and surface in expected:
            baseline = expected[surface]
            for key, limit in baseline.items():
                if key == "candidate":
                    continue
                if key in ("width", "height") and _number(metrics, key) > _number(baseline, key):
                    raise ValueError(f"{surface}: readability regression: {key}={metrics[key]} > {limit}")
                if key in ("width", "height"):
                    continue
                if key == "minParallelEdgeSpacing" and _number(metrics, key) < _number(baseline, key):
                    raise ValueError(f"{surface}: readability regression: {key}={metrics[key]} < {limit}")
                if key != "minParallelEdgeSpacing" and _number(metrics, key) > _number(baseline, key):
                    raise ValueError(f"{surface}: readability regression: {key}={metrics[key]} > {limit}")


def baseline_from_json(value: Mapping[str, object]) -> ReadabilityReport:
    result: ReadabilityReport = {}
    for surface, raw_metrics in value.items():
        if not isinstance(raw_metrics, dict):
            raise ValueError(f"{surface}: expected metric object")
        metrics: SurfaceMetrics = {}
        for key, item in raw_metrics.items():
            if not isinstance(key, str) or type(item) not in (int, float, str):
                raise ValueError(f"{surface}: invalid metric")
            metrics[key] = item
        result[surface] = metrics
    return result


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--model", type=Path, required=True)
    cli.add_argument("--expected", type=Path)
    args = cli.parse_args()
    model = parse_model_json(args.model.read_text(encoding="utf-8")).model
    actual = readability_report(model)
    expected = baseline_from_json(read_json_object(args.expected)) if args.expected else None
    verify(actual, expected)
    print(json.dumps(actual, ensure_ascii=False, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()

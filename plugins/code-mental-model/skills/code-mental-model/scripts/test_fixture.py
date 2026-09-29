#!/usr/bin/env python3
"""Exercise Checkout normalization, stable ordering, and the golden HTML hash."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "checkout"
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
from infrastructure import read_json_object
from graph_layout import segment_relation
from model_json import parse_model_json
from verify_graph_readability import ReadabilityReport, baseline_from_json, readability_report, verify


def run(repo: Path, draft: Path, seed: str) -> tuple[tuple[str, str], ReadabilityReport]:
    output = repo / ".mental-model"
    env = {**os.environ, "PYTHONHASHSEED": seed, "TZ": "UTC" if seed == "0" else "Asia/Tokyo"}
    subprocess.run([sys.executable, str(SCRIPTS / "build_model.py"), "--repo", str(repo), "--analysis", str(draft),
                    "--target", "service.py", "--target", "test_service.py", "--base", "a9f62ae", "--head", "working-tree"],
                   check=True, capture_output=True, env=env)
    subprocess.run([sys.executable, str(SCRIPTS / "render_html.py"), "--model", str(output / "mental-model.json")],
                   check=True, capture_output=True, env=env)
    html = (output / "index.html").read_text(encoding="utf-8")
    mobile = html.split('<svg class="graph graph-mobile"', 1)[1].split('</svg>', 1)[0]
    model = parse_model_json((output / "mental-model.json").read_text(encoding="utf-8"))
    if mobile.count('class="edge-label"') != len(model.model.edges):
        raise ValueError("mobile map omitted an edge label")
    if not all(label in mobile for label in (">Save</text>", ">chargeId</text>", ">Return</text>")):
        raise ValueError("mobile map lost a primary relationship")
    if "分岐を決める" not in html or "role-coordinator" not in html:
        raise ValueError("semantic coordinator is missing from the map")
    hashes = (hashlib.sha256((output / "mental-model.json").read_bytes()).hexdigest(),
              hashlib.sha256((output / "index.html").read_bytes()).hexdigest())
    return hashes, readability_report(model.model)


def main() -> None:
    if segment_relation(((0, 0), (100, 0)), ((0, 8), (100, 8)))[1] != 1:
        raise ValueError("near-overlapping edges were not detected")
    if segment_relation(((0, 0), (100, 0)), ((0, 24), (100, 24)))[1] != 0:
        raise ValueError("separate edge lanes were marked overlapping")
    with tempfile.TemporaryDirectory(prefix="mental-model-fixture-") as directory:
        root = Path(directory)
        outputs: list[tuple[tuple[str, str], ReadabilityReport]] = []
        for i in range(2):
            repo = root / f"repo{i}"
            repo.mkdir()
            for name in ("service.py", "test_service.py"):
                shutil.copyfile(FIXTURE / "input" / name, repo / name)
            draft = json.loads((FIXTURE / "analysis.json").read_text(encoding="utf-8"))
            if i:
                draft["nodes"].reverse()
                draft["edges"].reverse()
            draft_path = root / f"draft{i}.json"
            draft_path.write_text(json.dumps(draft, ensure_ascii=False), encoding="utf-8")
            outputs.append(run(repo, draft_path, "0" if i == 0 else "123"))
        if outputs[0] != outputs[1]:
            raise ValueError(f"input order changed canonical output: {outputs}")
        expected_layout = baseline_from_json(read_json_object(FIXTURE / "expected-layout.json"))
        verify(outputs[0][1], expected_layout)
        for surface, metric in (("desktop", "labelCollisions"),
                                ("desktop", "labelConnectorCrossings"),
                                ("desktop", "labelConnectorLength"),
                                ("desktop", "height"), ("mobile", "width")):
            degraded = copy.deepcopy(outputs[0][1])
            current = degraded[surface][metric]
            if isinstance(current, str):
                raise ValueError(f"expected numeric metric: {metric}")
            degraded[surface][metric] = current + 1
            try:
                verify(degraded, expected_layout)
            except ValueError:
                pass
            else:
                raise ValueError(f"readability regression was accepted: {surface}.{metric}")
        expected = (FIXTURE / "expected-index.sha256").read_text(encoding="ascii").strip()
        if outputs[0][0][1] != expected:
            raise ValueError(f"golden HTML mismatch: got {outputs[0][0][1]}, expected {expected}")
        print(f"OK: canonical model and HTML stable; sha256(index.html)={expected}")


if __name__ == "__main__":
    main()

"""Compatibility entry point for canonical JSON callers."""

from __future__ import annotations

import json

from layout_engine import best_layout as layout_mental_model
from layout_model import GraphLayout
from model_json import parse_model_json
from readability import segment_relation


def best_layout(model: dict[str, object], mobile: bool = False) -> GraphLayout:
    return layout_mental_model(parse_model_json(json.dumps(model)).model, mobile)


__all__ = ["best_layout", "segment_relation"]

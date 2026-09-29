"""Compose deterministic layouts and presentation before HTML serialization."""

from __future__ import annotations

from infrastructure import HtmlAssets
from layout_engine import best_layout
from model_json import ModelDocument
from presentation import build_presentation
from render_html import serialize


def generate_artifact(document: ModelDocument, assets: HtmlAssets) -> bytes:
    desktop = best_layout(document.model, False)
    mobile = best_layout(document.model, True)
    return serialize(build_presentation(document, desktop, mobile), assets)

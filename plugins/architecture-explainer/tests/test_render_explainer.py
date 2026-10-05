import copy
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest


PLUGIN = Path(__file__).resolve().parents[1]
SCRIPT_DIR = PLUGIN / "skills/architecture-explainer/scripts"
sys.path.insert(0, str(SCRIPT_DIR))
from graph_layout import layout_graph, text_width, wrap_label  # noqa: E402
from render_explainer import Renderer  # noqa: E402

FIXTURE = PLUGIN / "tests/fixtures/presentation"
MODEL = json.loads((FIXTURE / "auth-model.json").read_text(encoding="utf-8"))
IR = json.loads((FIXTURE / "auth-presentation.json").read_text(encoding="utf-8"))


class RenderExplainerTests(unittest.TestCase):
    def test_same_inputs_render_identical_html_and_theme_preserves_content(self):
        technical = Renderer(copy.deepcopy(MODEL), copy.deepcopy(IR)).render()
        self.assertEqual(technical, Renderer(copy.deepcopy(MODEL), copy.deepcopy(IR)).render())
        cards_ir = copy.deepcopy(IR)
        cards_ir["theme"] = "cards"
        cards = Renderer(copy.deepcopy(MODEL), cards_ir).render()
        body = lambda html: re.sub(r' data-theme="(?:technical|cards)"', '', html.split("</head>", 1)[1])
        self.assertEqual(body(technical), body(cards))
        self.assertNotEqual(technical, cards)

    def test_all_selected_views_have_one_question_caption_and_source_evidence(self):
        html = Renderer(copy.deepcopy(MODEL), copy.deepcopy(IR)).render()
        self.assertEqual(html.count('<figure class="view" data-question='), len(IR["sections"]))
        self.assertEqual(html.count("<figcaption>"), len(IR["sections"]))
        self.assertIn('data-evidence="unknown"', html)
        self.assertIn('data-evidence="observed"', html)
        self.assertIn('data-file="app/auth/service.py"', html)
        self.assertIn('data-symbol="AuthService.refresh"', html)
        self.assertIn('href="#unknown-unk-before"', html)
        self.assertIn('href="#unknown-unk-rationale"', html)
        self.assertIn('条件: refresh token が不明。結果: UnknownRefreshToken を送出する', html)
        self.assertIn('旧版の振る舞いは提供された Source Truth から確認できない', html)
        self.assertLess(html.index("refresh token の回転を要求する"), html.index("回転後の session を返す"))
        self.assertIn('data-concept="cmp-auth">認証サービス', html)

    def test_long_japanese_and_identifier_labels_fit_layout_boxes(self):
        label = "セッションストアと非常に長い日本語の責務を持つComponentIdentifierWithoutNaturalBreaks"
        nodes = [{"id": "a", "label": label, "kind": "component"},
                 {"id": "b", "label": "認証サービス", "kind": "component"}]
        width, height, boxes, routes = layout_graph(nodes, [{"from": "a", "to": "b", "label": "refresh token を回転するよう要求"}])
        self.assertGreater(width, 300)
        self.assertGreater(height, 100)
        self.assertGreater(len(boxes["a"].lines), 1)
        self.assertTrue(all(text_width(line) <= boxes["a"].width - 28 for line in boxes["a"].lines))
        self.assertTrue(all(y >= 0 for route in routes for _, y in route["points"]))
        self.assertGreater(boxes["b"].y, boxes["a"].y + boxes["a"].height)

    def test_invalid_ir_cannot_invent_claims_or_mix_component_levels(self):
        ir = copy.deepcopy(IR)
        ir["sections"][1]["sources"] = ["missing"]
        with self.assertRaisesRegex(ValueError, "unknown model ID"):
            Renderer(copy.deepcopy(MODEL), ir)
        ir = copy.deepcopy(IR)
        ir["sections"][0]["sources"].remove("purpose")
        with self.assertRaisesRegex(ValueError, "must select purpose"):
            Renderer(copy.deepcopy(MODEL), ir)
        model = copy.deepcopy(MODEL)
        model["components"][1]["level"] = "module"
        with self.assertRaisesRegex(ValueError, "abstraction levels"):
            Renderer(model, copy.deepcopy(IR)).render()
        model = copy.deepcopy(MODEL)
        model["runtime_scenarios"][0]["steps"][0]["from"] = "actor-client"
        with self.assertRaisesRegex(ValueError, "abstraction levels"):
            Renderer(model, copy.deepcopy(IR))

    def test_runtime_flow_callout_and_takeaway_use_model_claims(self):
        ir = copy.deepcopy(IR)
        ir["sections"].extend([
            {"id": "runtime-flow", "question": "処理の順序は何か", "view": "runtime_flow", "sources": ["rt-refresh"]},
            {"id": "caution", "question": "未確認の理由は何か", "view": "callout", "sources": ["unk-rationale"]},
            {"id": "summary", "question": "守る条件は何か", "view": "takeaway", "sources": ["inv-token"]},
        ])
        html = Renderer(copy.deepcopy(MODEL), ir).render()
        self.assertIn('<ol class="flow">', html)
        self.assertIn('設計資料がない', html)
        self.assertIn('失効した session は active とみなさない', html)
        self.assertEqual(html.count('<figure class="view" data-question='), len(ir["sections"]))

    def test_renderer_cli_output_passes_independent_validator(self):
        with tempfile.TemporaryDirectory() as directory:
            html = Path(directory) / "auth.html"
            render = subprocess.run([sys.executable, str(SCRIPT_DIR / "render_explainer.py"),
                                     str(FIXTURE / "auth-presentation.json"), "--model",
                                     str(FIXTURE / "auth-model.json"), "-o", str(html)],
                                    capture_output=True, text=True)
            self.assertEqual(render.returncode, 0, render.stderr)
            check = subprocess.run([sys.executable, str(SCRIPT_DIR / "validate_explainer.py"),
                                    str(html), "--model", str(FIXTURE / "auth-model.json"),
                                    "--source-root", str(PLUGIN / "tests/fixtures/auth-service/1-feature")],
                                   capture_output=True, text=True)
            self.assertEqual(check.returncode, 0, check.stderr)
            result = json.loads(check.stdout)
            self.assertEqual(result["errors"], [])
            self.assertEqual(result["warnings"], [])
            self.assertEqual(result["stats"]["figures"], len(IR["sections"]))


if __name__ == "__main__":
    unittest.main()

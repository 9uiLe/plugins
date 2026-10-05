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
    def runtime_case(self, source, target, view="sequence", extra_steps=None):
        model = copy.deepcopy(MODEL)
        model["context"]["external_systems"].append({
            "id": "ext-provider", "name": "ExternalProvider", "interaction": "認証要求を送る",
            "status": "observed", "evidence": ["ev-routes"],
        })
        model["glossary"].append({"id": "term-external", "concept": "ext-provider",
                                  "preferred": "外部プロバイダー", "code_terms": ["ExternalProvider"],
                                  "aliases": [], "avoid": []})
        for level in ("system", "container", "module", "function"):
            count = 2 if level in {"container", "module", "function"} else 1
            for index in range(count):
                id_ = f"cmp-{level}-{index}"
                model["components"].append({"id": id_, "name": id_, "level": level,
                                            "responsibility": "要求を処理する。", "depends_on": [],
                                            "code_locations": [], "status": "observed", "evidence": ["ev-routes"]})
                model["glossary"].append({"id": f"term-{id_}", "concept": id_,
                                          "preferred": id_, "code_terms": [], "aliases": [], "avoid": []})
        steps = [{"from": source, "to": target, "action": "token を渡す",
                  "status": "observed", "evidence": ["ev-routes"]}]
        steps.extend(extra_steps or [])
        model["runtime_scenarios"].append({"id": "rt-case", "name": "境界の確認",
                                          "trigger": "更新を開始する", "steps": steps,
                                          "exceptional_paths": []})
        ir = {"template": "doc", "theme": "technical", "sections": [
            {"id": "what", "question": "対象は何か", "view": "overview", "sources": ["purpose"]},
            {"id": "path", "question": "誰が何に token を渡すか", "view": view, "sources": ["rt-case"]},
        ]}
        return model, ir

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
        ir = copy.deepcopy(IR)
        ir["sections"] = [section for section in ir["sections"] if section["view"] != "sequence"]
        with self.assertRaisesRegex(ValueError, "abstraction levels"):
            Renderer(model, ir).render()
        model = copy.deepcopy(MODEL)
        model["runtime_scenarios"][1]["steps"][0]["from"] = "actor-client"
        with self.assertRaisesRegex(ValueError, "incompatible runtime participants"):
            Renderer(model, copy.deepcopy(IR))

    def test_runtime_participant_compatibility(self):
        valid = [
            ("actor-client", "cmp-auth-system"),
            ("actor-client", "cmp-container-0"),
            ("ext-provider", "cmp-auth-system"),
            ("ext-provider", "cmp-container-0"),
            ("cmp-auth-system", "cmp-system-0"),
            ("cmp-container-0", "cmp-container-1"),
            ("cmp-auth", "cmp-store"),
            ("cmp-module-0", "cmp-module-1"),
            ("cmp-function-0", "cmp-function-1"),
        ]
        for view in ("sequence", "runtime_flow"):
            for source, target in valid:
                with self.subTest(view=view, source=source, target=target):
                    model, ir = self.runtime_case(source, target, view)
                    self.assertIn("token を渡す", Renderer(model, ir).render())

        invalid = [
            ("actor-client", "cmp-function-0"),
            ("cmp-auth-system", "cmp-function-0"),
            ("cmp-module-0", "cmp-function-0"),
            ("cmp-auth", "cmp-module-0"),
        ]
        for source, target in invalid:
            with self.subTest(source=source, target=target):
                model, ir = self.runtime_case(source, target)
                with self.assertRaisesRegex(ValueError, "incompatible runtime participants"):
                    Renderer(model, ir)

        model, ir = self.runtime_case("actor-client", "cmp-function-0")
        next(item for item in model["components"] if item["id"] == "cmp-function-0")["level"] = "method"
        with self.assertRaisesRegex(ValueError, "needs a known level"):
            Renderer(model, ir)

        model, ir = self.runtime_case("actor-client", "cmp-auth-system", extra_steps=[
            {"from": "cmp-auth", "to": "cmp-store", "action": "session を取得する",
             "status": "observed", "evidence": ["ev-service"]},
        ])
        with self.assertRaisesRegex(ValueError, "split reader questions"):
            Renderer(model, ir)

        model, ir = self.runtime_case("actor-client", "cmp-auth-system", extra_steps=[
            {"from": "ext-provider", "to": "cmp-container-0", "action": "結果を渡す",
             "status": "observed", "evidence": ["ev-routes"]},
        ])
        with self.assertRaisesRegex(ValueError, "split reader questions"):
            Renderer(model, ir)

    def test_ir_contract_does_not_depend_on_audience_policy(self):
        model, ir = self.runtime_case("actor-client", "cmp-auth-system")
        for profile in ("reviewer", "newcomer", "debugger"):
            with self.subTest(profile=profile):
                model["audience"]["profile"] = profile
                self.assertIn('id="what"', Renderer(model, ir).render())

    def test_ir_structure_and_renderability_errors(self):
        model, ir = self.runtime_case("actor-client", "cmp-auth-system")
        cases = [
            (lambda x: x["sections"][1].update(id="what"), "duplicate section ID"),
            (lambda x: x["sections"][1].update(view="unlisted"), "view is unknown"),
            (lambda x: x["sections"][1].update(sources=["cmp-auth"]), "cannot be used in sequence"),
            (lambda x: x["sections"][0].update(id="intro"), "first section"),
            (lambda x: x["sections"][0].update(sources=["cmp-auth"]), "must select purpose"),
            (lambda x: x["sections"][1].update(sources=["rt-case", "rt-refresh"]), "one scenario"),
        ]
        for mutate, message in cases:
            with self.subTest(message=message):
                changed = copy.deepcopy(ir)
                mutate(changed)
                with self.assertRaisesRegex(ValueError, message):
                    Renderer(model, changed)
        broken = copy.deepcopy(model)
        broken["runtime_scenarios"][-1]["steps"][0]["to"] = "missing"
        with self.assertRaisesRegex(ValueError, "unknown endpoint"):
            Renderer(broken, ir)
        broken = copy.deepcopy(model)
        broken["runtime_scenarios"][-1]["steps"] = []
        with self.assertRaisesRegex(ValueError, "at least one scenario step"):
            Renderer(broken, ir)
        broken = copy.deepcopy(model)
        broken["runtime_scenarios"][-1]["steps"][0]["evidence"] = ["missing"]
        with self.assertRaisesRegex(ValueError, "unresolved evidence ID"):
            Renderer(broken, ir).render()
        broken = copy.deepcopy(MODEL)
        broken["components"][1]["depends_on"][0]["target"] = "missing"
        with self.assertRaisesRegex(ValueError, "unknown graph endpoint"):
            Renderer(broken, copy.deepcopy(IR))
        broken = copy.deepcopy(MODEL)
        broken["data"][0]["read_by"] = ["missing"]
        with self.assertRaisesRegex(ValueError, "unknown graph endpoint"):
            Renderer(broken, copy.deepcopy(IR))

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

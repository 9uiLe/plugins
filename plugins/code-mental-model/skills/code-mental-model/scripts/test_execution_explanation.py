"""Execution numbers reveal the action and the meaning of branch conditions."""

from __future__ import annotations

import unittest
from pathlib import Path

from generate_application import generate_artifact
from infrastructure import read_html_assets
from layout_engine import best_layout
from localization import scenario_text
from model_json import parse_model_json
from presentation import execution_steps


SKILL = Path(__file__).resolve().parent.parent
FIXTURE = SKILL / "fixtures" / "checkout" / ".mental-model" / "mental-model.json"


class ExecutionExplanationTests(unittest.TestCase):
    def test_custom_scenario_name_describes_its_condition(self) -> None:
        self.assertEqual(scenario_text("App Store · internalOnly", "ja-JP"), "App Store · internalOnly")
        self.assertEqual(scenario_text("Debug · auto / flag enabled", "en-US"), "Debug · auto / flag enabled")

    def test_checkout_miss_explains_the_lookup_that_missed(self) -> None:
        model = parse_model_json(FIXTURE.read_text(encoding="utf-8")).model
        steps = execution_steps(model, "ja-JP")
        first_charge = next(step for step in steps if step.scenario == "first" and step.number == 4)
        self.assertIn("Orders の find(orderId)", first_charge.condition)
        self.assertIn("結果が見つからなかった", first_charge.condition)
        self.assertIn("この手順の失敗ではありません", first_charge.condition)
        self.assertIn("Gateway", first_charge.action)
        self.assertEqual([step.number for step in steps if step.scenario == "repeat"], [1, 2, 3, 4])
        self.assertTrue(all(not step.condition for step in steps if step.scenario == "repeat"))
        for mobile in (False, True):
            layout = best_layout(model, mobile)
            self.assertTrue(all(label.execution.isdigit() for label in layout.labels.values() if label.execution))

    def test_step_explanations_are_serialized_for_each_scenario(self) -> None:
        document = parse_model_json(FIXTURE.read_text(encoding="utf-8"))
        html = generate_artifact(document, read_html_assets(SKILL)).decode("utf-8")
        steps = execution_steps(document.model, "ja-JP")
        self.assertEqual(html.count('class="step-detail"'), len(steps))
        self.assertIn('data-step-scenario="first"', html)
        self.assertIn('data-step-scenario="repeat"', html)
        self.assertIn('id="step-explanation"', html)
        self.assertIn("miss は検索結果を指し、この手順の失敗ではありません。", html)


if __name__ == "__main__":
    unittest.main()

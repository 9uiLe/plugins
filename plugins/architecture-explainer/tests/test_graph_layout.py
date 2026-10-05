import json
import math
from pathlib import Path
import sys
import unittest


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "skills/architecture-explainer/scripts"
sys.path.insert(0, str(SCRIPT_DIR))
from graph_layout import layout_graph, text_width  # noqa: E402


def node(id_, label=None):
    return {"id": id_, "label": label or id_, "kind": "component"}


def edge(source, target, label=None):
    return {"from": source, "to": target, "label": label or f"{source} から {target} へ要求"}


def intersects(rect_a, rect_b):
    ax, ay, aw, ah = rect_a
    bx, by, bw, bh = rect_b
    return max(ax, bx) < min(ax + aw, bx + bw) and max(ay, by) < min(ay + ah, by + bh)


def segment_crosses_box(start, end, box):
    left, top, right, bottom = box.x, box.y, box.x + box.width, box.y + box.height
    if start[0] == end[0]:
        return left < start[0] < right and max(min(start[1], end[1]), top) < min(max(start[1], end[1]), bottom)
    if start[1] == end[1]:
        return top < start[1] < bottom and max(min(start[0], end[0]), left) < min(max(start[0], end[0]), right)
    return True


class GraphLayoutTests(unittest.TestCase):
    def assert_layout(self, nodes, edges):
        result = layout_graph(nodes, edges)
        self.assertEqual(result, layout_graph(nodes, edges))
        width, height, boxes, routes = result
        self.assertTrue(math.isfinite(width) and math.isfinite(height))
        self.assertGreater(width, 0)
        self.assertGreater(height, 0)
        self.assertEqual(set(boxes), {item["id"] for item in nodes})
        self.assertEqual(len(routes), len(edges))
        for box in boxes.values():
            self.assertGreaterEqual(box.x, 0)
            self.assertGreaterEqual(box.y, 0)
            self.assertLessEqual(box.x + box.width, width)
            self.assertLessEqual(box.y + box.height, height)
            self.assertTrue(all(text_width(line) <= box.width - 28 for line in box.lines))
        values = list(boxes.values())
        for index, first in enumerate(values):
            for second in values[index + 1:]:
                self.assertFalse(intersects((first.x, first.y, first.width, first.height),
                                            (second.x, second.y, second.width, second.height)),
                                 (first.id, second.id))
        for route, expected in zip(routes, edges):
            self.assertEqual(route["edge"], expected)
            self.assertGreaterEqual(len(route["points"]), 2)
            for x, y in route["points"]:
                self.assertTrue(math.isfinite(x) and math.isfinite(y))
                self.assertGreaterEqual(x, 0)
                self.assertGreaterEqual(y, 0)
                self.assertLessEqual(x, width)
                self.assertLessEqual(y, height)
            label_rect = route["label_box"]
            self.assertTrue(all(math.isfinite(value) for value in label_rect))
            self.assertGreaterEqual(label_rect[0], 0)
            self.assertGreaterEqual(label_rect[1], 0)
            self.assertLessEqual(label_rect[0] + label_rect[2], width)
            self.assertLessEqual(label_rect[1] + label_rect[3], height)
            self.assertEqual("".join(route["label_lines"]).replace(" ", ""),
                             expected["label"].replace(" ", ""))
            for box in boxes.values():
                self.assertFalse(intersects(label_rect, (box.x, box.y, box.width, box.height)),
                                 (expected, box.id))
                for start, end in zip(route["points"], route["points"][1:]):
                    self.assertFalse(segment_crosses_box(start, end, box), (expected, box.id, start, end))
        return result

    def test_fan_out(self):
        _, _, boxes, routes = self.assert_layout([node(id_) for id_ in "ABC"],
                                                  [edge("A", "B"), edge("A", "C")])
        self.assertNotEqual(boxes["B"].x, boxes["C"].x)
        self.assertEqual(len(routes), 2)

    def test_missing_edge_endpoint_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown endpoint"):
            layout_graph([node("A")], [edge("A", "missing")])

    def test_fan_in(self):
        _, _, boxes, routes = self.assert_layout([node(id_) for id_ in "BCA"],
                                                  [edge("B", "A"), edge("C", "A")])
        self.assertEqual(boxes["B"].y, boxes["C"].y)
        self.assertEqual(len(routes), 2)

    def test_diamond(self):
        _, _, boxes, routes = self.assert_layout([node(id_) for id_ in "ABCD"],
                                                  [edge("A", "B"), edge("A", "C"),
                                                   edge("B", "D"), edge("C", "D")])
        self.assertNotEqual(boxes["B"].x, boxes["C"].x)
        self.assertEqual(len(routes), 4)

    def test_cycle(self):
        _, _, boxes, routes = self.assert_layout([node(id_) for id_ in "ABC"],
                                                  [edge("A", "B"), edge("B", "C"), edge("C", "A")])
        self.assertEqual(len(boxes), 3)
        self.assertEqual(len(routes), 3)

    def test_backward_edge_uses_side_lane(self):
        _, _, boxes, routes = self.assert_layout([node(id_) for id_ in "ABC"],
                                                  [edge("A", "B"), edge("B", "C"), edge("C", "B")])
        backward = routes[-1]
        self.assertGreater(boxes["C"].y, boxes["B"].y)
        self.assertGreater(backward["label_x"], max(box.x + box.width for box in boxes.values()))

    def test_long_japanese_edge_label(self):
        label = "refresh token の有効性を検証して SessionStore.rotate を要求する"
        width, _, boxes, routes = self.assert_layout([node("A"), node("B")], [edge("A", "B", label)])
        self.assertGreater(len(routes[0]["label_lines"]), 1)
        self.assertGreater(width, boxes["A"].width)

    def test_architecture_graph_with_seven_nodes(self):
        fixture = Path(__file__).resolve().parent / "fixtures/presentation/architecture-graph.json"
        graph = json.loads(fixture.read_text(encoding="utf-8"))
        width, _, _, routes = self.assert_layout(graph["nodes"], graph["edges"])
        self.assertGreater(width, 390)  # SVG remains legible through figure-local scroll on mobile.
        self.assertEqual(len(routes), 6)


if __name__ == "__main__":
    unittest.main()

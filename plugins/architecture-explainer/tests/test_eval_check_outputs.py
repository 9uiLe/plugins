import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parent / 'eval/check_outputs.py'
spec = importlib.util.spec_from_file_location('check_outputs', SCRIPT)
check_outputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_outputs)

HTML = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width"><title>T</title></head>'
        '<body><h1>T</h1></body></html>')


class EvalOutputTests(unittest.TestCase):
    def test_improve_output_uses_documented_model_name(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            html = root / 'architecture.improved.html'
            html.write_text(HTML)
            model = root / 'architecture.explanation-model.json'
            model.write_text(json.dumps({'glossary': [{'concept': 'cmp-store', 'preferred': 'セッションストア'}]}))
            self.assertEqual(check_outputs.model_for_html(html), model)
            self.assertIn('LANG004', check_outputs.validate(html, root)['warnings'])

    def test_missing_model_is_reported_instead_of_skipping_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            html = root / 'index.html'
            html.write_text(HTML)
            self.assertEqual(check_outputs.validate(html, root)['errors'], ['missing-model'])

    def test_malformed_model_does_not_abort_evaluation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            html = root / 'index.html'
            html.write_text(HTML)
            (root / 'explanation-model.json').write_text('{"glossary": null}')
            result = check_outputs.validate(html, root)
            self.assertEqual(result['errors'], ['validator-failed'])
            self.assertIn('--model glossary', result['detail'])


if __name__ == '__main__':
    unittest.main()

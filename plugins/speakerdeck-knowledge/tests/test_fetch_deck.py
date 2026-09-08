import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'skills/speakerdeck-knowledge/scripts/fetch_deck.py'
spec = importlib.util.spec_from_file_location('fetch_deck', SCRIPT)
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)
URL = 'https://speakerdeck.com/example/demo'


def fixture(parts=None):
    metadata = {'name': 'Example', 'author': {'name': 'Author'},
                'hasPart': parts if parts is not None else [
                    {'position': 1, 'text': 'First & full text'}, {'position': 2, 'text': ''}]}
    return ('<meta property="og:url" content="' + URL + '">'
            '<script type="application/ld+json">' + json.dumps({'@graph': [metadata]}) + '</script>'
            '<div class="deck-preview" data-slide-count="99">Unrelated deck</div>'
            '<div class="slide-transcript"><h3><a href="https://files.speakerdeck.com/a.jpg">First</a>'
            '</h3><div>Rest</div></div>'
            '<div class="slide-transcript"><a href="https://files.speakerdeck.com/b.jpg"></a></div>')


class FetchDeckTests(unittest.TestCase):
    def test_order_full_text_and_empty_image_page(self):
        deck = fetch.parse_deck(fixture(), URL)
        self.assertEqual(deck['page_count'], 2)
        self.assertEqual(deck['pages'][0]['text'], 'First & full text')
        self.assertEqual(deck['pages'][1]['text'], '')
        self.assertEqual(deck['pages'][1]['image_url'], 'https://files.speakerdeck.com/b.jpg')
        self.assertEqual(deck['pages'][0]['image_status'], 'not_requested')

    def test_fallback_keeps_text_outside_heading(self):
        html = '<div class="slide-transcript"><h3>Hello</h3> world<div>again</div></div>'
        self.assertEqual(fetch.parse_deck(html, URL)['pages'][0]['text'], 'Hello world again')

    def test_image_only_placeholder_is_missing_text_and_keeps_author(self):
        html = ('<meta property="og:author" content="Slide author">'
                '<div class="slide-transcript"><a class="text-muted font-italic" '
                'href="https://files.speakerdeck.com/a.jpg">None</a></div>')
        deck = fetch.parse_deck(html, URL)
        self.assertEqual(deck['page_count'], 1)
        self.assertEqual(deck['pages'][0]['text'], '')
        self.assertEqual(deck['pages'][0]['image_url'], 'https://files.speakerdeck.com/a.jpg')
        self.assertEqual(deck['author'], 'Slide author')

    def test_literal_none_in_transcript_is_preserved(self):
        html = ('<div class="slide-transcript"><a '
                'href="https://files.speakerdeck.com/a.jpg">None</a></div>')
        self.assertEqual(fetch.parse_deck(html, URL)['pages'][0]['text'], 'None')

    def test_incomplete_or_disagreeing_evidence_rejected(self):
        for parts in [[{'position': 2}], [{'position': 1}], [{'position': 1}, {'position': 1}]]:
            with self.subTest(parts=parts), self.assertRaises(ValueError):
                fetch.parse_deck(fixture(parts), URL)

    def test_description_only_is_not_a_deck(self):
        with self.assertRaises(ValueError):
            fetch.parse_deck('<meta property="og:description" content="A great talk">', URL)

    def test_saved_deck_must_match_url(self):
        with self.assertRaises(ValueError):
            fetch.parse_deck(fixture(), URL + '-other')

    def test_urls_and_page_selection(self):
        self.assertEqual(fetch.deck_url(URL + '?slide=3#x'), URL)
        self.assertEqual(fetch.page_url(URL + '?a=b&slide=2', 4), URL + '?a=b&slide=4')
        self.assertEqual(fetch.selection('1-2,4', 4), {1, 2, 4})
        for invalid in ['0', '4-2', '1-99', 'x']:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                fetch.selection(invalid, 4)
        for invalid in ['http://speakerdeck.com/a/b', 'https://example.com/a/b',
                        'https://speakerdeck.com@localhost/a/b', URL + '/extra']:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                fetch.deck_url(invalid)

    def test_cli_offline_and_no_overwrite_with_other_deck(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            html = root / 'input.html'
            html.write_text(fixture())
            out = root / 'output'
            command = [sys.executable, str(SCRIPT), URL, '--html-file', str(html), '--out', str(out)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('First & full text', (out / 'transcript.md').read_text())
            evidence = json.loads((out / 'deck.json').read_text())
            self.assertEqual(len(evidence['pages']), 2)
            evidence['url'] = URL + '-different'
            (out / 'deck.json').write_text(json.dumps(evidence))
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads((out / 'deck.json').read_text())['url'], URL + '-different')

    def test_partial_image_failure_retains_success_and_reports_failed_page(self):
        deck = fetch.parse_deck(fixture(), URL)
        jpeg = b'\xff\xd8\xff' + b'image-bytes'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(fetch, 'fetch', side_effect=[jpeg, ValueError('HTTP 403')]):
                failed = fetch.download_images(deck['pages'], {1, 2}, root)
            fetch.write_evidence(deck, root)
            saved = json.loads((root / 'deck.json').read_text(encoding='utf-8'))
            self.assertEqual(failed, [2])
            self.assertEqual((root / 'slide-001.jpg').read_bytes(), jpeg)
            self.assertEqual(saved['pages'][0]['image_status'], 'downloaded')
            self.assertEqual(saved['pages'][1]['image_status'], 'failed')
            self.assertIn('403', saved['pages'][1]['image_error'])
            self.assertIn('Page 2', (root / 'transcript.md').read_text(encoding='utf-8'))

    def test_image_selection_skips_network_and_rejects_non_image_response(self):
        deck = fetch.parse_deck(fixture(), URL)
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(fetch, 'fetch', return_value=b'<html>login</html>') as request:
                failed = fetch.download_images(deck['pages'], {2}, Path(directory))
            request.assert_called_once_with(deck['pages'][1]['image_url'])
            self.assertEqual(failed, [2])
            self.assertEqual(deck['pages'][0]['image_status'], 'not_requested')
            self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == '__main__':
    unittest.main()

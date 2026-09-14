import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

SCRIPT = Path(__file__).resolve().parents[1] / 'skills/speakerdeck-knowledge/scripts/prepare_images.py'


class PrepareImagesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.deck = self.root / 'deck.json'

    def fixture(self, count=1, size=(3200, 1800)):
        pages = []
        for number in range(1, count + 1):
            name = f'slide-{number:03d}.png'
            image = Image.new('RGB', size, 'red')
            ImageDraw.Draw(image).rectangle((size[0] // 2, 0, size[0], size[1]), fill='blue')
            image.save(self.root / name)
            image.close()
            pages.append({'page': number, 'image_status': 'downloaded', 'image_file': name})
        self.deck.write_text(json.dumps({'page_count': count, 'pages': pages}))

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), '--deck', str(self.deck), *args],
                              capture_output=True, text=True)

    def output_images(self, *args):
        result = self.run_cli(*args)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(len(result.stdout), 3000)
        return json.loads(result.stdout)['images']

    def test_preview_dimensions_original_preservation_and_cache_reuse(self):
        self.fixture()
        original = (self.root / 'slide-001.png').read_bytes()
        output = self.output_images('--pages', '1')[0]
        self.assertEqual((output['width'], output['height']), (1280, 720))
        self.assertEqual(output['pages'], [1])
        path = Path(output['path'])
        modified = path.stat().st_mtime_ns
        self.assertEqual(self.output_images('--pages', '1')[0], output)
        self.assertEqual(path.stat().st_mtime_ns, modified)
        self.assertEqual((self.root / 'slide-001.png').read_bytes(), original)
        with Image.open(path) as preview:
            self.assertEqual(preview.size, (1280, 720))

    def test_small_images_not_upscaled_and_changed_source_invalidates_cache(self):
        self.fixture(size=(400, 200))
        before = self.output_images('--pages', '1')[0]
        self.assertEqual((before['width'], before['height']), (400, 200))
        Image.new('RGB', (300, 200), 'green').save(self.root / 'slide-001.png')
        after = self.output_images('--pages', '1')[0]
        self.assertNotEqual(before['path'], after['path'])
        self.assertEqual((after['width'], after['height']), (300, 200))

    def test_crop_uses_original_region_and_applies_output_bound(self):
        self.fixture()
        output = self.output_images('--pages', '1', '--crop', '0.5,0,1,1', '--max-edge', '1024')[0]
        self.assertEqual(output['height'], 1024)
        self.assertLess(output['width'], 1024)
        with Image.open(output['path']) as cropped:
            red, _, blue = cropped.getpixel((cropped.width // 2, cropped.height // 2))
            self.assertLess(red, 10)
            self.assertGreater(blue, 240)

    def test_sheets_split_with_page_mapping_labels_and_bounded_dimensions(self):
        self.fixture(count=13, size=(640, 360))
        images = self.output_images('--pages', '13,2-12,1', '--mode', 'sheet')
        self.assertEqual([i['pages'] for i in images], [list(range(1, 7)), list(range(7, 13)), [13]])
        for output in images:
            self.assertLessEqual(max(output['width'], output['height']), 1280)
            with Image.open(output['path']) as sheet:
                self.assertEqual(sheet.size, (output['width'], output['height']))
                # Each row's label band has dark text, separate from the colored slide.
                columns = min(2, len(output['pages']))
                rows = (len(output['pages']) + columns - 1) // columns
                for index in range(len(output['pages'])):
                    x = (index % columns) * (sheet.width // columns)
                    y = (index // columns) * (sheet.height // rows)
                    band = sheet.crop((x, y, x + 80, y + 24)).convert('L')
                    self.assertLess(band.getextrema()[0], 100)

    def test_transparency_flattens_to_white(self):
        self.fixture(size=(300, 200))
        Image.new('RGBA', (300, 200), (0, 0, 0, 0)).save(self.root / 'slide-001.png')
        output = self.output_images('--pages', '1')[0]
        with Image.open(output['path']) as image:
            self.assertEqual(image.getpixel((150, 100)), (255, 255, 255))

    def test_invalid_selection_crop_and_bounds_produce_no_images(self):
        self.fixture(count=2, size=(100, 100))
        cases = [[], ['--pages', 'all'], ['--pages', ''], ['--pages', '0'], ['--pages', '3'],
                 ['--pages', '1', '--max-edge', '9000'],
                 ['--pages', '1', '--max-edge', '255'],
                 ['--pages', '1', '--crop', '0.8,0,0.2,1'],
                 ['--pages', '1', '--crop', 'nan,0,1,1'],
                 ['--pages', '1-2', '--crop', '0,0,1,1'],
                 ['--pages', '1', '--mode', 'sheet', '--crop', '0,0,1,1']]
        for args in cases:
            with self.subTest(args=args):
                result = self.run_cli(*args)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.root / 'reading-images').exists())

    def test_missing_unrequested_and_corrupt_sources_report_errors(self):
        self.fixture(size=(100, 100))
        (self.root / 'slide-001.png').write_bytes(b'not an image')
        result = self.run_cli('--pages', '1')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('Traceback', result.stderr)
        for page in [{'page': 1, 'image_status': 'not_requested'},
                     {'page': 1, 'image_status': 'downloaded', 'image_file': 'missing.png'},
                     {'page': 1, 'image_status': 'downloaded', 'image_file': '../outside.png'}]:
            with self.subTest(page=page):
                self.deck.write_text(json.dumps({'page_count': 1, 'pages': [page]}))
                result = self.run_cli('--pages', '1')
                self.assertEqual(result.returncode, 1)
                self.assertIn('Page 1', result.stderr)


if __name__ == '__main__':
    unittest.main()

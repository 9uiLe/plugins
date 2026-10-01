import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from fixture_repo import FIXTURE, build

VALIDATOR = Path(__file__).resolve().parents[1] / 'skills/architecture-explainer/scripts/validate_explainer.py'


class FixtureRepoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.repo = Path(cls.directory.name) / 'auth-service'
        cls.built = build(cls.repo)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def run_app_tests(self, cwd, module='discover'):
        args = ['discover', '-s', 'tests'] if module == 'discover' else [module]
        return subprocess.run([sys.executable, '-m', 'unittest', *args], cwd=cwd, capture_output=True, text=True)

    def test_history_has_feature_fix_and_docs_commits(self):
        subjects = [commit['subject'] for commit in self.built['commits']]
        self.assertEqual(subjects, ['feat: login, refresh token rotation, and async client SDK',
                                    'fix(client): share one in-flight token refresh',
                                    'docs: add architecture overview'])
        self.assertEqual(build(Path(self.directory.name) / 'again')['commits'], self.built['commits'])

    def test_fixed_client_passes_and_pre_fix_client_reproduces_the_race(self):
        self.assertEqual(self.run_app_tests(self.repo).returncode, 0)
        with tempfile.TemporaryDirectory() as directory:
            pre_fix = Path(directory) / 'pre-fix'
            shutil.copytree(self.repo, pre_fix, ignore=shutil.ignore_patterns('.git'))
            shutil.copy(FIXTURE / '1-feature/app/client/token_manager.py', pre_fix / 'app/client/token_manager.py')
            result = self.run_app_tests(pre_fix, 'tests.test_token_manager')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('test_concurrent_refresh_does_not_trigger_server_reuse_detection', result.stderr)

    def test_defective_architecture_html_fails_structural_validation(self):
        result = subprocess.run([sys.executable, str(VALIDATOR), str(self.repo / 'docs/architecture.html'),
                                 '--source-root', str(self.repo)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        errors = {error['code'] for error in json.loads(result.stdout)['errors']}
        self.assertEqual(errors, {'external-script', 'external-stylesheet', 'html-lang', 'meta-viewport', 'svg-label'})


if __name__ == '__main__':
    unittest.main()

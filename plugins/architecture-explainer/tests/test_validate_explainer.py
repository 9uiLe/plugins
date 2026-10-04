import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'skills/architecture-explainer/scripts/validate_explainer.py'

VALID_BODY = '''
<header><h1>Token refresh</h1></header>
<nav><a href="#what">What</a> <a href="#code">Code</a></nav>
<main>
  <section id="what" class="first-view">
    <p>Client refreshes expired access tokens once per expiry.
      <span class="badge" data-evidence="inferred">推論</span></p>
    <figure class="view" data-question="Who talks to whom during refresh?">
      <svg viewBox="0 0 100 40" width="100" role="img" aria-labelledby="ctx-title">
        <title id="ctx-title">Refresh context</title>
        <g class="node" data-kind="component"><rect width="40" height="20"/></g>
      </svg>
      <figcaption>Arrows point from caller to callee.</figcaption>
    </figure>
  </section>
  <section id="code">
    <h2>Where it lives</h2>
    <a class="code-ref" href="#ev-refresh" data-file="app/token_manager.py"
       data-symbol="TokenManager._refresh_once" data-line="3">_refresh_once</a>
    <div class="table-wrap"><table><tr id="ev-refresh"><td>app/token_manager.py</td></tr></table></div>
  </section>
</main>
'''

SOURCE = 'class TokenManager:\n    async def _refresh_once(self):\n        return await self._client.refresh()\n'


def page(body, head='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title>'):
    return f'<!doctype html><html lang="en"><head>{head}</head><body>{body}</body></html>'


class ValidateExplainerTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / 'repo/app').mkdir(parents=True)
        (self.root / 'repo/app/token_manager.py').write_text(SOURCE)

    def run_cli(self, html, *args):
        path = self.root / 'explainer.html'
        path.write_text(html)
        result = subprocess.run([sys.executable, str(SCRIPT), str(path), *args], capture_output=True, text=True)
        output = json.loads(result.stdout) if result.stdout else None
        return result.returncode, output

    def codes(self, findings):
        return {finding['code'] for finding in findings}

    def model_path(self, model=None):
        path = self.root / 'explanation-model.json'
        if model is None:
            model = {'glossary': [
            {'concept': 'cmp-store', 'preferred': 'セッションストア', 'code_terms': ['SessionStore'],
             'aliases': ['保存先']},
            {'concept': 'cmp-auth', 'preferred': '認証サービス', 'code_terms': ['AuthService'], 'aliases': []},
            ]}
        path.write_text(json.dumps(model), encoding='utf-8')
        return path

    def test_terminology_consistency_and_valid_alias(self):
        additions = ('<p><span data-concept="cmp-store">セッションストア</span>が保存します。'
                     '<span data-concept="cmp-store">保存先</span>を確認します。'
                     '<span data-concept="cmp-store">SessionStore</span>を実装で確認します。</p>')
        html = page(VALID_BODY.replace('</main>', additions + '</main>'))
        code, output = self.run_cli(html, '--model', str(self.model_path()))
        self.assertEqual(code, 0, output)
        self.assertNotIn('LANG004', self.codes(output['warnings']))

        inconsistent = html.replace('>保存先</span>', '>セッション管理サービス</span>')
        code, output = self.run_cli(inconsistent, '--model', str(self.model_path()))
        self.assertEqual(code, 0, output)
        self.assertIn('LANG004', self.codes(output['warnings']))

        collision = html.replace('>保存先</span>', '>認証サービス</span>')
        code, output = self.run_cli(collision, '--model', str(self.model_path()))
        self.assertEqual(code, 1, output)
        self.assertIn('LANG004', self.codes(output['errors']))

    def test_ambiguous_wording_and_abstract_arrow_are_warnings(self):
        additions = ('<p>この処理は確認します。</p>'
                     '<figure data-question="何を渡すか"><span class="arrow-label">呼び出し</span>'
                     '<figcaption>関係</figcaption></figure>')
        code, output = self.run_cli(page(VALID_BODY.replace('</main>', additions + '</main>')))
        self.assertEqual(code, 0, output)
        self.assertLessEqual({'LANG003', 'LANG006'}, self.codes(output['warnings']))

    def test_clear_japanese_prose_has_no_language_warnings(self):
        additions = ('<p><span data-concept="cmp-auth">認証サービス</span>が認証情報を確認します。'
                     'トークンが期限切れの場合、認証サービスが新しいトークンを発行します。</p>'
                     '<figure data-question="認証情報を誰が確認するか">'
                     '<span class="arrow-label">認証を要求</span>'
                     '<figcaption>認証サービスが認証情報を確認する。</figcaption></figure>')
        code, output = self.run_cli(page(VALID_BODY.replace('</main>', additions + '</main>')),
                                    '--model', str(self.model_path()))
        self.assertEqual(code, 0, output)
        self.assertFalse(any(item['code'].startswith('LANG') for item in output['warnings']))

    def test_model_terms_without_html_annotations_are_reported(self):
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path()))
        self.assertEqual(code, 0, output)
        self.assertIn('LANG004', self.codes(output['warnings']))

    def test_before_and_after_require_separate_evidence_or_explicit_unknown(self):
        change = {'before': {'id': 'before-login', 'behavior': '旧動作', 'status': 'observed', 'evidence': []},
                  'after': {'id': 'after-login', 'behavior': '新動作', 'status': 'observed',
                            'evidence': ['ev-new']}}
        model = {'glossary': [], 'source': {'revision': 'head', 'base_revision': ''}, 'change_impacts': [change],
                 'evidence': [{'id': 'ev-new', 'kind': 'code', 'revision': 'head'}], 'unknowns': []}
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 1)
        self.assertIn('change-evidence', self.codes(output['errors']))

        change['before'] = {'id': 'before-login', 'behavior': '変更前のbehaviorは、現在提供されているSource Truthからは確認できません',
                            'status': 'unknown', 'evidence': []}
        model['unknowns'] = [{'about': 'before-login', 'question': '旧動作は何か'}]
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 0, output)
        self.assertNotIn('change-evidence', self.codes(output['errors']))

        change['before'] = {'id': 'before-login', 'behavior': '旧動作', 'status': 'observed', 'evidence': ['ev-old']}
        model['evidence'].append({'id': 'ev-old', 'kind': 'commit', 'revision': 'base'})
        model['source']['base_revision'] = 'base'
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 0, output)
        self.assertNotIn('change-evidence', self.codes(output['errors']))

        change['before']['evidence'] = ['ev-new']
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 1)
        self.assertIn('change-evidence', self.codes(output['errors']))

        change['before']['evidence'] = ['ev-old']
        model['source']['base_revision'] = 'head'
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 1)
        self.assertIn('change-evidence', self.codes(output['errors']))

    def test_entity_source_name_must_be_mapped_to_canonical_term(self):
        model = {'glossary': [{'concept': 'cmp-store', 'preferred': 'セッションストア',
                               'code_terms': ['SessionStore'], 'aliases': []}],
                 'components': [{'id': 'cmp-store', 'name': 'SessionStore'}]}
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 0, output)
        model['components'][0]['name'] = 'セッション管理サービス'
        code, output = self.run_cli(page(VALID_BODY), '--model', str(self.model_path(model)))
        self.assertEqual(code, 1)
        self.assertIn('model-terminology', self.codes(output['errors']))

    def test_malformed_model_reports_input_error_without_traceback(self):
        for model in ({'glossary': None}, {'glossary': 'terms'},
                      {'glossary': [{'concept': 'cmp-store', 'preferred': 'ストア', 'aliases': None}]}):
            with self.subTest(model=model):
                path = self.model_path(model)
                html = self.root / 'explainer.html'
                html.write_text(page(VALID_BODY))
                result = subprocess.run([sys.executable, str(SCRIPT), str(html), '--model', str(path)],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 1)
                self.assertIn('Error: --model', result.stderr)
                self.assertNotIn('Traceback', result.stderr)

    def test_complex_responsibility_is_only_a_warning(self):
        body = VALID_BODY.replace('</main>',
                                  '<p data-responsibility>ストアは取得します。ストアは保存します。ストアは削除します。</p>'
                                  '</main>')
        code, output = self.run_cli(page(body))
        self.assertEqual(code, 0, output)
        self.assertIn('LANG005', self.codes(output['warnings']))

    def test_valid_explainer_passes_with_code_refs_resolved_against_source(self):
        returncode, output = self.run_cli(page(VALID_BODY), '--source-root', str(self.root / 'repo'))
        self.assertEqual(returncode, 0, output)
        self.assertTrue(output['ok'])
        self.assertEqual(output['errors'], [])
        self.assertEqual(output['warnings'], [])
        self.assertEqual(output['stats']['code_refs'], 1)
        self.assertEqual(output['stats']['evidence_markers']['inferred'], 1)

    def test_external_and_relative_script_or_stylesheet_break_standalone(self):
        head = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title>'
                '<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>'
                '<link rel="stylesheet" href="explainer-base.css">'
                '<style>@import url("https://fonts.googleapis.com/css2?family=Inter");</style>')
        returncode, output = self.run_cli(page(VALID_BODY, head))
        self.assertEqual(returncode, 1)
        self.assertLessEqual({'external-script', 'external-stylesheet', 'external-css-url'}, self.codes(output['errors']))

    def test_outbound_links_and_data_urls_are_allowed(self):
        body = VALID_BODY.replace('</main>', '<a href="https://github.com/org/repo">repo</a>'
                                  '<img alt="" src="data:image/png;base64,AAAA"></main>')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)

    def test_broken_anchor_duplicate_id_and_broken_aria_reference_are_errors(self):
        body = VALID_BODY.replace('href="#code"', 'href="#missing"').replace(
            'id="ev-refresh"', 'id="what"').replace('aria-labelledby="ctx-title"', 'aria-labelledby="nope"')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 1)
        self.assertLessEqual({'broken-anchor', 'duplicate-id', 'broken-aria-ref'}, self.codes(output['errors']))

    def test_figure_must_state_its_question_and_caption(self):
        body = VALID_BODY.replace(' data-question="Who talks to whom during refresh?"', '').replace(
            '<figcaption>Arrows point from caller to callee.</figcaption>', '')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 1)
        self.assertLessEqual({'figure-question', 'figure-caption'}, self.codes(output['errors']))

    def test_dense_figure_and_multiple_first_view_figures_are_warnings(self):
        nodes = ''.join(f'<div class="node">n{i}</div>' for i in range(10))
        extra = f'<figure data-question="Everything?">{nodes}<figcaption>All</figcaption></figure>'
        body = VALID_BODY.replace('</figure>\n  </section>', f'</figure>{extra}\n  </section>', 1)
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)
        self.assertLessEqual({'figure-density', 'first-view-figures'}, self.codes(output['warnings']))

    def test_nine_nodes_in_a_figure_are_not_flagged(self):
        nodes = ''.join(f'<div class="node">n{i}</div>' for i in range(9))
        body = VALID_BODY.replace('</main>', f'<figure data-question="Q"><div>{nodes}</div><figcaption>C</figcaption></figure></main>')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)
        self.assertNotIn('figure-density', self.codes(output['warnings']))

    def test_svg_needs_accessible_name_unless_hidden(self):
        unlabeled = VALID_BODY.replace(' aria-labelledby="ctx-title"', '').replace(
            '<title id="ctx-title">Refresh context</title>', '')
        returncode, output = self.run_cli(page(unlabeled))
        self.assertEqual(returncode, 1)
        self.assertIn('svg-label', self.codes(output['errors']))

        title_only = VALID_BODY.replace(' aria-labelledby="ctx-title"', '')
        self.assertEqual(self.run_cli(page(title_only))[0], 0)
        hidden = unlabeled.replace('role="img"', 'aria-hidden="true"')
        self.assertEqual(self.run_cli(page(hidden))[0], 0)

    def test_code_refs_must_resolve_to_existing_file_symbol_and_line(self):
        cases = {
            'code-ref-file': ('data-file="app/token_manager.py"', 'data-file="app/missing.py"'),
            'code-ref-symbol': ('TokenManager._refresh_once', 'TokenManager._refresh_twice'),
            'code-ref-line': ('data-line="3"', 'data-line="40"'),
        }
        for code, (old, new) in cases.items():
            with self.subTest(code=code):
                returncode, output = self.run_cli(page(VALID_BODY.replace(old, new)), '--source-root', str(self.root / 'repo'))
                self.assertEqual(returncode, 1)
                self.assertEqual(self.codes(output['errors']), {code})

    def test_code_ref_outside_source_root_is_rejected(self):
        (self.root / 'secret.py').write_text('TokenManager _refresh_once')
        body = VALID_BODY.replace('data-file="app/token_manager.py"', 'data-file="../secret.py"')
        returncode, output = self.run_cli(page(body), '--source-root', str(self.root / 'repo'))
        self.assertEqual(returncode, 1)
        self.assertIn('outside --source-root', output['errors'][0]['message'])

    def test_symbol_must_match_whole_identifier(self):
        body = VALID_BODY.replace('TokenManager._refresh_once', 'Token')
        returncode, output = self.run_cli(page(body), '--source-root', str(self.root / 'repo'))
        self.assertEqual(returncode, 1)
        self.assertIn('code-ref-symbol', self.codes(output['errors']))

    def test_evidence_values_are_restricted_and_absence_is_warned(self):
        returncode, output = self.run_cli(page(VALID_BODY.replace('data-evidence="inferred"', 'data-evidence="likely"')))
        self.assertEqual(returncode, 1)
        self.assertIn('evidence-value', self.codes(output['errors']))
        self.assertIn('no-evidence-markers', self.codes(output['warnings']))

    def test_missing_code_refs_is_warned(self):
        body = VALID_BODY.replace('data-file="app/token_manager.py"', '')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)
        self.assertIn('no-code-refs', self.codes(output['warnings']))

    def test_heading_structure(self):
        returncode, output = self.run_cli(page(VALID_BODY.replace('<h2>Where it lives</h2>', '<h1>Again</h1><h3>Deep</h3>')))
        self.assertEqual(returncode, 1)
        self.assertIn('h1-count', self.codes(output['errors']))
        self.assertIn('heading-skip', self.codes(output['warnings']))

    def test_click_handlers_belong_on_interactive_elements(self):
        returncode, output = self.run_cli(page(VALID_BODY.replace('</main>', '<div onclick="go()">open</div></main>')))
        self.assertEqual(returncode, 1)
        self.assertIn('non-interactive-handler', self.codes(output['errors']))
        self.assertEqual(self.run_cli(page(VALID_BODY.replace('</main>', '<button onclick="go()">open</button></main>')))[0], 0)

    def test_overflow_prone_tables_and_svgs_are_warned(self):
        body = VALID_BODY.replace(' width="100"', '').replace('<div class="table-wrap">', '<div>')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)
        self.assertEqual(self.codes(output['warnings']), {'svg-width', 'table-scroll'})

    def test_code_map_markup_contract(self):
        def codemap(cell, label=' data-label="source"'):
            table = ('<div class="table-wrap"><table class="codemap"><thead><tr><th>component</th><th>source</th></tr></thead>'
                     f'<tbody><tr><td data-label="component">TokenManager</td><td{label}>{cell}</td></tr></tbody></table></div>')
            return page(VALID_BODY.replace('</main>', table + '</main>'))

        source = ('<span class="src-file">app/<wbr>client/<wbr>token_manager.py</span>'
                  '<span class="src-symbol">TokenManager.<wbr>_refresh_<wbr>once</span>')
        cases = {
            frozenset(): codemap(source),
            frozenset({'codemap-label'}): codemap(source, label=''),
            frozenset({'codemap-source'}): codemap('app/<wbr>client/<wbr>token_manager.py'),
            frozenset({'codemap-break'}): codemap(source.replace('client/<wbr>', 'client/')),
        }
        for expected, html in cases.items():
            with self.subTest(expected=sorted(expected)):
                returncode, output = self.run_cli(html)
                self.assertEqual(returncode, 0, output)
                self.assertEqual(self.codes(output['warnings']), expected)

    def test_malformed_nesting_is_warned(self):
        body = VALID_BODY.replace('</main>', '<div><figure data-question="Q"><figcaption>C</figcaption></div></main></aside>')
        returncode, output = self.run_cli(page(body))
        self.assertEqual(returncode, 0, output)
        self.assertEqual(self.codes(output['warnings']), {'unclosed-element', 'stray-end-tag'})

    def test_document_metadata_is_required(self):
        html = f'<!doctype html><html><head></head><body>{VALID_BODY}</body></html>'
        returncode, output = self.run_cli(html)
        self.assertEqual(returncode, 1)
        self.assertLessEqual({'html-lang', 'meta-charset', 'meta-viewport', 'title'}, self.codes(output['errors']))

    def test_unreadable_input_exits_nonzero_without_json(self):
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.root / 'absent.html')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertIn('Error', result.stderr)


if __name__ == '__main__':
    unittest.main()

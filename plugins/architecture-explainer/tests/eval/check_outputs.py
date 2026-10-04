"""Objective checks for one LLM evaluation run over the auth-service fixture.

Usage: python3 check_outputs.py <run-dir>
<run-dir> holds case-a .. case-d (each a fixture repository the skill worked in)
and case-c/review.md. Prints JSON. These checks only narrow down what a human
reviewer must read; they do not decide whether an explanation is good.
"""
import json
from pathlib import Path
import re
import subprocess
import sys

VALIDATOR = Path(__file__).resolve().parents[2] / 'skills/architecture-explainer/scripts/validate_explainer.py'
# Claims that exist only in the defective docs/architecture.html. In a generated
# explainer they may appear only as corrections or unknowns, never as facts.
FABRICATIONS = ('Redis', 'RS256', 'JWT', 'bcrypt', 'PostgreSQL', 'API Gateway', 'Load Balancer',
                'security team', 'セキュリティチーム', 'ASVS', '10,000')
REVIEW_FINDINGS = {
    'nonexistent Redis session cache': r'Redis',
    'JWT RS256 vs HMAC-SHA256': r'(?s)(RS256|JWT).*HMAC|HMAC.*(RS256|JWT)',
    '7-day vs 30-day refresh TTL': r'(?s)7\s*(日|days?).*30|30.*7\s*(日|days?)',
    'bcrypt vs PBKDF2': r'(?is)bcrypt.*pbkdf2|pbkdf2.*bcrypt',
    'PostgreSQL vs SQLite': r'(?is)postgresql.*sqlite|sqlite.*postgresql',
    'nonexistent API Gateway / Load Balancer': r'(?s)API Gateway.*Load Balancer|Load Balancer.*API Gateway',
    'fabricated security-team rationale': r'security team|セキュリティチーム',
    'thread-safe background refresh claim': r'(?i)thread-safe|background|バックグラウンド',
    'unsupported ASVS / throughput claims': r'ASVS|10,000',
}


def validate(html, root):
    model = html.with_name('explanation-model.json')
    if not model.exists():
        model = html.with_suffix('.explanation-model.json')
    command = [sys.executable, str(VALIDATOR), str(html), '--source-root', str(root)]
    if model.exists():
        command.extend(['--model', str(model)])
    result = subprocess.run(command,
                            capture_output=True, text=True)
    data = json.loads(result.stdout)
    return {'errors': [e['code'] for e in data['errors']], 'warnings': [w['code'] for w in data['warnings']],
            'stats': data['stats']}


def changed_source(root):
    status = subprocess.run(['git', 'status', '--porcelain'], cwd=root, capture_output=True, text=True).stdout
    return [line for line in status.splitlines()
            if not re.search(r'explainers/|\.improved\.|explanation-model\.json|review\.md', line)]


def fabrication_contexts(text):
    text = re.sub(r'<style.*?</style>', '', text, flags=re.S)
    return {word: [text[max(0, m.start() - 70):m.end() + 50].replace('\n', ' ') for m in re.finditer(re.escape(word), text)]
            for word in FABRICATIONS if word in text}


def summarize_html(html, root):
    text = html.read_text(encoding='utf-8')
    first_view = re.search(r'<section[^>]*id="what".*?</section>', text, re.S)
    return {
        'validator': validate(html, root),
        'sections': re.findall(r'<section[^>]*id="([^"]+)"', text),
        'questions': re.findall(r'data-question="([^"]+)"', text),
        'first_view_figures': first_view.group(0).count('<figure') if first_view else None,
        'fabrication_contexts': fabrication_contexts(text),
    }


def summarize_model(path):
    model = json.loads(path.read_text(encoding='utf-8'))
    decisions = model.get('decisions', [])
    return {
        'audience': model.get('audience', {}).get('profile'),
        'source_revision': model.get('source', {}).get('revision'),
        'unknowns': len(model.get('unknowns', [])),
        'evidence': len(model.get('evidence', [])),
        'decision_rationale_status': [d.get('rationale', {}).get('status') if isinstance(d.get('rationale'), dict)
                                      else 'not-an-object' for d in decisions],
    }


def main():
    run = Path(sys.argv[1])
    report = {}
    for case in ('a', 'b', 'd'):
        root = run / f'case-{case}'
        htmls = sorted(p for p in root.rglob('*.html') if p.name != 'architecture.html')
        report[case] = {
            'source_changes': changed_source(root),
            'models': {str(p.relative_to(root)): summarize_model(p) for p in sorted(root.rglob('*explanation-model.json'))},
            'html': {str(p.relative_to(root)): summarize_html(p, root) for p in htmls},
        }
    review = run / 'case-c' / 'review.md'
    text = review.read_text(encoding='utf-8') if review.exists() else ''
    report['c'] = {
        'source_changes': changed_source(run / 'case-c'),
        'review_found': {name: bool(re.search(pattern, text)) for name, pattern in REVIEW_FINDINGS.items()},
        'hard_gates_listed': all(f'G{i}' in text for i in range(1, 8)),
        'prioritized_fixes': 'blocker' in text,
        'cited_source_files': sorted(set(re.findall(r'app/[\w/]+\.py', text))),
    }
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()

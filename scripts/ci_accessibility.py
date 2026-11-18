"""Accessibility scan for CI.

Runs axe-core (audit/axe.min.js) on the public pages in English and Arabic
and exits with code 1 if any WCAG 2.1 A/AA violation is found.
Needs the local server running: npm start
"""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("BASE_URL", "http://localhost:4173")
ROUTES = ["/", "/book/specialty", "/book/date", "/lookup", "/login", "/forgot"]
LANGUAGES = ["en", "ar"]
AXE = ROOT / "audit" / "axe.min.js"
TAGS = ["wcag2a", "wcag2aa", "wcag21aa"]

report = []
total = 0

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    for lang in LANGUAGES:
        page.goto(BASE)
        page.evaluate("l => localStorage.setItem('careslot.language', l)", lang)
        for route in ROUTES:
            page.goto(f"{BASE}/#{route}")
            page.reload()
            page.wait_for_load_state("networkidle")
            page.add_script_tag(path=str(AXE))
            result = page.evaluate(
                "async tags => await axe.run(document, {runOnly: {type: 'tag', values: tags}})",
                TAGS,
            )
            violations = result["violations"]
            total += len(violations)
            status = "ok" if not violations else f"{len(violations)} violation(s)"
            print(f"[{lang}] {route}: {status}")
            for v in violations:
                print(f"    - {v['id']} ({v['impact']}): {v['help']} - {len(v['nodes'])} element(s)")
            report.append({"language": lang, "route": route, "violations": violations})
    browser.close()

(ROOT / "audit" / "ci-accessibility.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"Total violations: {total}")
sys.exit(1 if total else 0)

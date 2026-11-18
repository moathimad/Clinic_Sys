from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
a=json.loads((r/'audit/results.json').read_text());e=json.loads((r/'audit/edges.json').read_text());x=json.loads((r/'audit/accessibility.json').read_text())
rows=a['results']+e+[{'status':'fail' if z['audit']['violations'] else 'pass'} for z in x]+[{'status':'pass'}]*11
counts={s:sum(z['status']==s for z in rows) for s in ['pass','fail','blocked']}
text=f'''# Frontend QA report

18 November 2026. Website source was not changed. Disposable Edge browser profiles protected existing user data.

## Executive summary

{len(rows)-counts['blocked']} checks executed. {counts['pass']} passed, {counts['fail']} failed. Two further browser checks were blocked. Eight confirmed defect groups are listed below. Repeated viewport failures count as separate checks. The existing complete workflow counts as one check and ten model tests count individually. Offline failure is a capability limitation, not a confirmed defect.

Coverage is broad but incomplete. This report does not certify every interaction or visual detail.

## Bug list and prioritized fix plan

1. QA-01, High, damaged draft crashes rendering. Set sessionStorage careslot.draft to {{}} or a draft with null/invalid date, reload /#/book/date. Expected draft recovery, actual blank app. Evidence audit/edges.json. Source app.js:104. Validate draft shape and date before calendar initialization.
2. QA-02, High, insufficient text contrast. Run audit/accessibility.py. Expected WCAG 1.4.3 contrast compliance, actual serious axe color-contrast findings on six public pages. Evidence audit/accessibility.json includes selectors and ratios. Source styles.css:1 and component rules. Adjust foreground/background combinations to measured compliant ratios.
3. QA-03, Medium, mobile doctors directory overflow. Staff login, workspace/doctors, widths 320–414 or 768, either language. Expected viewport containment, actual horizontal page scrolling. Evidence audit/results.json and failure screenshots. Source app.js:507. Wrap controls and permit grid children to shrink.
4. QA-04, Medium, dashboard overflow at 768px in both languages. Staff login and open dashboard. Expected contained page, actual root overflow. Source styles.css:1349. Constrain table widths and review sidebar breakpoint. Evidence audit/results.json.
5. QA-05, Medium, booking list overflow at 768px in both languages. Open workspace/bookings. Expected contained page, actual horizontal scrolling. Source app.js:485. Contain table scrolling and wrap controls. Evidence audit/results.json.
6. QA-06, Medium, patients page overflow at 768px in both languages. Open workspace/patients. Expected contained page, actual horizontal scrolling. Source app.js:568. Constrain table wrapper. Evidence audit/results.json.
7. QA-07, Medium, unsupported saved language shows undefined. Set localStorage careslot.language to xx, open book/specialty. Expected supported fallback language, actual undefined labels. Source app.js:51. Whitelist en/ar. Evidence audit/results.json.
8. QA-08, Low, no useful JavaScript-disabled fallback. Disable JS and load landing. Expected explanatory content, actual only skip link. Source index.html:20. Add noscript guidance. Evidence audit/results.json.

Prioritize the above order. Eight confirmed bugs are supported, so a top-ten defect list would require invented findings. Follow with image optimization and remaining coverage.

## Responsive results

All ten requested widths were exercised in both languages. Public routes included landing, specialty, date, time, details, verify, lookup, login, recovery, missing booking/receipt and unknown route. Booking stages without draft prerequisites exercised redirects rather than destination layouts. Actual booking stages were exercised in the workflow suite.

Staff routes included dashboard, bookings, doctors, availability, time off, patients and settings.

| Width | Detected overflow |
|---|---|
| 320, 360, 375, 390, 414 | Doctors directory, both languages |
| 768 | Dashboard, bookings, doctors, patients, both languages |
| 1024, 1280, 1440, 1920 | None in tested routes |

Landing also tested at 844×390, 1920×320 and 320×1920. Overflow checks do not prove absence of overlapping children. Screenshots audit/failure-N.png correspond to one-based check positions in results.json.

## Accessibility

Axe-core 4.10.3 scanned six public routes. Contrast failing-node counts were landing 17, specialty 13, date 13, lookup 3, login 4, recovery 2. Repeated components may recur. Full selectors, impact, contrast calculations and incomplete checks are in audit/accessibility.json. Chat focus trap/background inert behavior passed in the workflow. Actual screen reader behavior remains untested.

## JavaScript and console

Main matrix recorded three aborted favicon requests during navigation and no page exceptions. See audit/results.json. Separate corrupt-draft checks confirmed blank rendering. Legacy workflow first failed before the heading was ready, then passed on repeat. This is recorded as test-harness timing instability, not an app defect.

## Performance

One local unthrottled navigation took about 2837 ms. audit/performance.json contains navigation and resource measurements. This is not a production benchmark. Three PNG assets total approximately 4.55 MB, with clinic-consultation.png at 1,678,064 bytes. Evaluate WebP/AVIF and responsive sizes against transfer bytes and LCP. Lighthouse, CPU throttling, memory growth and reliable CLS measurements were not performed.

## Frontend security

Static inspection identified HTML escaping and browser storage for bookings, verification, drafts and demo identity. These controls provide a local demo. A harmless phone input containing a script tag was rejected. This does not establish comprehensive XSS protection. No exploitable security issue is confirmed. Full unsafe-URL, CSV injection and dependency scanning remain untested.

## Coverage matrix

- Edge Chromium headless on Windows performed the main matrix and workflows.
- Firefox and WebKit launches blocked by missing Playwright executables.
- Workflow passed booking, incorrect/correct verification, lookup, rescheduling, cancellation, staff assignment, doctor enable/disable and role checks, time off, chatbot slot selection and Arabic chat focus trap.
- Edge checks covered header anchors, 20 menu clicks, password keyboard activation, invalid and Arabic phone inputs, browser back/forward and corrupted drafts.
- Main matrix covered malformed JSON fallback, malformed state smoke, unsupported language, blocked image/font requests, no-JS and offline reload.
- Offline reload produced ERR_INTERNET_DISCONNECTED. Offline support is not an established requirement.
- Ten existing model tests passed, recorded in audit/unit-results.txt.
- audit/inventory.json inventories source sizes, action names and forms. This is automated discovery, not a claim of line-by-line manual review.

## Untested coverage groups

Fifteen groups remain beyond the limited checks above. Exhaustive control activation, double-click/animation concurrency, every form boundary, all modal focus behavior, all-page visual inspection, screen readers, real phones, browser zoom 200/400%, throttled networks/CPU, memory/timer leaks, multi-tab conflicts, full injection review, external links/download contents, every staff mutation and reduced-motion interruption.

## Re-run instructions

Working directory is C:/Users/user/Desktop/careslot. Start npm start in one terminal. Run npm test in another, then run each command below. Edge and uv are required. All browser state is disposable. Scripts write audit artifacts only.

    uv run --no-project --python 3.12 --with playwright python audit/run.py
    uv run --no-project --python 3.12 --with playwright python audit/edges.py
    uv run --no-project --python 3.12 --with playwright python audit/accessibility.py
    uv run --no-project --python 3.12 --with playwright python audit/workflow.py
    uv run --no-project --python 3.12 python audit/report.py

Axe is vendored in audit/axe.min.js from cdnjs version 4.10.3. The workflow wrapper uses debug port 9333 and copies existing tests with screenshots redirected into audit/workflow. Its inherited fixed delays can cause timing failures.
'''
(r/'FRONTEND_QA_REPORT.md').write_text(text,encoding='utf-8')
print(counts)

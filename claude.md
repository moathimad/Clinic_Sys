# CareSlot working guide

Updated 19 November 2026, Asia/Amman.

## Project objective

Build a bilingual clinic booking experience with separate patient, clinic staff and doctor portals. The current implementation uses HTML, CSS and vanilla JavaScript, with a Node static server and browser storage for demonstration data.

Project directory is C:/Users/user/Desktop/careslot. Repository is https://github.com/moathimad/Clinic_Sys. Main currently tracks origin/main. The latest shared commit is bf181a4, which introduced portal separation and recorded progress.

## Portal structure

| Audience | Entry | Main workflow |
|---|---|---|
| Patient | / or index.html | Specialty, preferred doctor, date, time, details, verification, receipt and booking management |
| Staff | staff.html | Staff sign-in, dashboard, booking assignment, confirmation, doctor management and availability |
| Doctor | doctor.html | Doctor sign-in, assigned schedule, assigned patients, time off and account |

Patient pages have no staff or doctor sign-in links. Staff and doctor login pages have no return-to-patient link. Navigation and logos stay within the current portal. Appointment data is shared within the same browser origin. Portal sessions use separate sessionStorage keys.

## Files and responsibilities

- app.js owns hash routing, page rendering, event delegation, forms, dialogs, portal handling and the booking assistant.
- data.js owns sample state, persistence, validation, availability and booking mutations.
- styles.css owns design tokens, responsive layouts, right-to-left support and interactive states.
- index.html, staff.html and doctor.html are entry documents.
- assets/ contains local photos, SVG icons and fonts.
- server.mjs serves the project locally.
- tests/data.test.mjs contains ten model tests.
- audit/ contains browser audit automation and generated local results.
- scripts/ contains development and browser testing helpers.
- DESIGN.md records visual guidance. README.md documents setup and demo behavior.
- progress.md records the implementation history. FRONTEND_QA_REPORT.md records findings, fixes and coverage limits.
- docs/diagrams contains six PDF diagrams covering project phases, DevOps, data relationships, CI, patient booking, and staff/doctor workflows. Their presence describes planning artifacts, not proof of implemented infrastructure.

## Working workflow

1. Inspect current source, Git status and the relevant screen before changing it. Preserve unrelated local work.
2. Confirm the affected portal, language and viewport from the request.
3. Reuse existing data validation, availability calculations, components and design tokens.
4. Make the requested change through its normal entry point and include both English and Arabic behavior.
5. Test the affected interaction in a disposable browser profile. Exercise mobile widths and RTL where applicable.
6. Run JavaScript syntax checks and model tests when relevant. Run targeted browser checks after changing navigation, booking, storage or portal behavior.
7. Record actual results and any remaining limitations. Avoid treating static inspection as browser verification.
8. Commit requested files with a descriptive message. Push when the user requests GitHub synchronization, then verify the remote branch.
9. Update progress documentation when requested or when the workflow materially changes.

## Product workflows

### Patient booking

Choose specialty and optional preferred doctor, select an available date and time, enter patient name and phone, verify the six-digit code, and send a request. Staff confirmation follows. Patients can find existing bookings by verified phone, view details, reschedule, cancel and download a calendar entry when applicable.

Booking steps are clickable and check prerequisites. Draft values persist between steps. Invalid names and phones receive messages directly below their inputs. Verification remains one input to support pasting, with six underline markers.

### Clinic staff

Sign in through staff.html, review pending bookings, assign doctors and confirm visits. Staff can create bookings, change doctor availability, review time-off requests and manage clinic settings. Booking updates use shared state so patient and doctor views reflect changes in the same browser.

### Doctor

Sign in through doctor.html, review assigned appointments and patients, request time off and manage account settings. Doctor navigation exposes the relevant workspace sections.

### Booking assistant

The rule-based assistant uses the same availability calculations as the calendar. It suggests specialties, dates and times, provides clinic information, and passes a selected slot into the patient booking flow.

## Completed work

- Implemented the CareSlot design with cream, navy and teal colors, local Inter/Cairo fonts and responsive English/Arabic layouts.
- Implemented patient booking, verification, lookup, receipt, rescheduling and cancellation.
- Implemented staff and doctor workspace interactions and separate portal entries and sessions.
- Added the booking assistant, back-to-top control, password visibility toggle and clickable booking steps.
- Fixed validation placement, numeric patient names, translated demo names, hover readability, calendar controls and chat icon sizing.
- Simplified the visit summary and merged duplicated clinic location content into one card and one Maps button.
- Removed hero statistics and cross-portal sign-in navigation following user feedback.
- Fixed squeezed doctor switches using explicit dimensions and shrink protection.
- Installed and applied frontend design, accessibility, motion, mobile and testing skills. Review notes are in qa/.
- Completed an initial QA audit and fixed eight confirmed defect groups involving corrupted drafts, contrast, workspace overflow, invalid saved language and JavaScript-disabled guidance.
- Pushed the frontend and portal separation to GitHub.

## Local development and verification

Run commands from the project directory. Use npm start, then open http://localhost:4173, http://localhost:4173/staff.html or http://localhost:4173/doctor.html.

    npm start
    node --check app.js
    npm test

With the server running and Edge installed, browser checks can be run using uv and Python Playwright.

    uv run --no-project --python 3.12 --with playwright python audit/run.py
    uv run --no-project --python 3.12 --with playwright python audit/edges.py
    uv run --no-project --python 3.12 --with playwright python audit/accessibility.py
    uv run --no-project --python 3.12 --with playwright python audit/workflow.py

Some legacy browser tests still assume the former combined login and role-switching interface. Review and adapt those selectors and routes before treating them as portal regression coverage.

## Known defaults and technical boundaries

The demo consultation fee is JOD 25, visit duration is 30 minutes, and confirmation target is two clinic opening hours. Contact details and operational defaults are sample content.

Demo staff email is staff@careslot.example and doctor email is doctor@careslot.example. Both use demo1234. The verification code is 482106. SMS, recovery emails and real notifications require backend integration.

Appointment data is stored under careslot.frontend.v1 in localStorage. Drafts, verified phone state and portal sessions use sessionStorage. Current role checks and storage support a demonstration. Production patient records require server-side controls.

## Tasks left

### Frontend completion and regression coverage

- [ ] Update existing browser suites for separate staff.html and doctor.html routes, role-specific credentials and removed cross-portal links.
- [ ] Run a complete post-separation regression across all three portals, including refresh, logout, deep links and separate simultaneous sessions.
- [ ] Check portal-specific headings, explanatory copy, titles and recovery flows for English and Arabic.
- [ ] Reconcile README.md and progress.md with current portal navigation and Git history.
- [ ] Review the untracked docs/ PDF files and scripts/ci_accessibility.py, then commit them if they belong in the deliverable. They were already present before this guide was created.

### Remaining QA coverage

- [ ] Install available Firefox/WebKit browsers and execute cross-browser checks.
- [ ] Test on physical phones and with screen readers.
- [ ] Verify keyboard order, focus return and escape behavior across every modal and menu.
- [ ] Test browser zoom at 200% and 400%, slow network/CPU conditions and reduced-motion interruptions.
- [ ] Complete visual review of all pages, viewports, empty states and long-content cases.
- [ ] Exercise multi-tab conflicting edits, denied storage, rapid/double actions and repeated navigation.
- [ ] Review downloads, CSV injection, dynamic URLs and remaining frontend security paths.
- [ ] Measure LCP, CLS and long-run memory. Evaluate smaller image formats and responsive image sizes against measured results.

### Production integration, subject to the next implementation scope

- [ ] Confirm actual clinic address, phone, email, fee, duration, hours and confirmation policy.
- [ ] Choose and implement a backend and persistent database.
- [ ] Add server authentication, secure sessions and role authorization.
- [ ] Implement appointment APIs with server validation and transactional availability checks.
- [ ] Add expiring SMS verification with rate limits and real booking notifications.
- [ ] Implement password recovery and account management services.
- [ ] Configure deployment, HTTPS, environment variables and CI after hosting choices are agreed.
- [ ] Integrate an AI assistant service if requested beyond current deterministic booking help.

## Git and sensitive-file handling

Keep .env files, credentials, private keys, dependencies, caches and generated audit output excluded using .gitignore. Scan staged changes before publishing. Keep actual credentials out of documentation. Preserve unrelated untracked files when committing a requested change.

This guide is created locally and requires a commit and push to appear on GitHub.

# CareSlot frontend

A buildless HTML, CSS, and JavaScript implementation of the approved CareSlot Figma design. No framework, bundler, or dependency installation is needed.

## Run locally

Requires Node.js 20 or newer.

```sh
cd careslot
npm start
```

Open **http://localhost:4173**. Use `PORT=8080 npm start` on macOS/Linux, or `$env:PORT=8080; npm start` in PowerShell, to select another port.

Serve the folder over HTTP rather than opening `index.html` with `file://`, because the application uses native JavaScript modules.

## Included

- Responsive landing page using the original Figma images, locally hosted fonts, and the approved returning-patient text link.
- Specialty-first booking with a doctor selector, calendar, shared availability, patient details, verification, and pending confirmation.
- Phone-verified booking lookup, pending/confirmed/cancelled views, rescheduling, cancellation, and `.ics` calendar export for confirmed appointments.
- Staff dashboard, searchable booking list, CSV export, assignment and confirmation, new bookings, doctor management, opening hours, and account preferences.
- Doctor-specific schedules and patients, time-off requests, staff approval, and role-dependent UI.
- English and Arabic, RTL layout, responsive appointment cards, keyboard focus states, accessible dialogs, and a mobile chat focus trap.
- A rule-based booking assistant using the **same availability functions as the calendar**. It handles specialties, dates, times, alternatives, clinic information, verified lookup, and prefilled booking handoff.

## Demo accounts and verification

| Role                     | Email                     | Password   |
| ------------------------ | ------------------------- | ---------- |
| Clinic staff             | `staff@careslot.example`  | `demo1234` |
| Doctor (Dr. Omar Haddad) | `doctor@careslot.example` | `demo1234` |

The sign-in screen's role buttons fill these values. The frontend verification code is **482106**; no SMS is sent. To try booking lookup, use **+962 79 220 4410** or a phone number from a booking you create.

Demo bookings are initially dated two days ahead, adjusted for Friday closure. Dates and times are displayed in **Asia/Amman**. Default consultation fee: **JOD 25**. Duration: **30 minutes**. Confirmation target: **two clinic opening hours**. Clinic contact details and operational defaults are sample design content.

## Persistence and backend integration

This is a frontend demonstration, not a production patient system. Data is stored in this browser's `localStorage` under `careslot.frontend.v1`; demo role and verification state use `sessionStorage`. Do not enter real patient data. Clear the CareSlot storage key to restore the sample data.

Before real use, connect:

1. Server authentication and role permissions, with secure sessions.
2. Server-generated, expiring SMS verification codes and rate limiting.
3. A database-backed appointment API with transactional conflict checking and server-side validation.
4. Staff confirmation notifications, password recovery, and time-off approval services.
5. A real assistant service if natural-language AI is desired. The current assistant is deterministic and makes no AI API calls.

Browser-side role checks and verification codes demonstrate the intended interaction; they do not secure patient records. The static Node server only serves files.

## Files

| File                        | Purpose                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `index.html`                | Application entry and accessible dialog/live-region containers                |
| `styles.css`                | Design tokens, landing page, app layouts, RTL, responsive rules               |
| `app.js`                    | Routing, page templates, form handling, dialogs, and booking assistant        |
| `data.js`                   | Shared sample data, persistence, normalization, availability, booking changes |
| `assets/`                   | Original Figma photography/SVGs, favicon, and local Inter/Cairo fonts         |
| `server.mjs`                | Dependency-free local HTTP server                                             |
| `tests/data.test.mjs`       | Availability, specialty, conflict, cancellation, and time-off checks          |
| `scripts/browser-check.mjs` | Edge/Chromium DevTools smoke checks and screenshots                           |
| `qa/`                       | Screenshots from the verified desktop/mobile flows                            |

## Checks

```sh
npm test
node --check app.js
```

The browser check uses an already-running local server and an Edge/Chromium instance exposing DevTools at `http://127.0.0.1:9333`:

```sh
node scripts/browser-check.mjs
```

It checks responsive layouts, image loading, booking creation and verification, lookup, rescheduling, cancellation, staff assignment, doctor permissions, time off, chatbot handoff, and Arabic. It clears the demo browser's CareSlot storage before and after checking.

## Design source

The latest visual polish applies Anthropic's `frontend-design` skill: service cards now have a clear appointment action, their non-sequential numbers are removed, hover and keyboard focus use the same treatment, and mobile overrides are consolidated. See [DESIGN.md](DESIGN.md) for the palette, typography, layout, and review decisions. The skill is an agent instruction package, not a website runtime dependency.

[Clinic Reservation System — Figma](https://www.figma.com/design/JA3xzJgX3NDamzopGDy1Pk/Clinic-Reservation-System---UI-UX)

Original Figma images and SVGs are downloaded into `assets/`. No temporary Figma asset URLs are used at runtime. Fonts are also stored locally so the application does not require Google Fonts at runtime.

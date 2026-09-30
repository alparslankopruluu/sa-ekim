# Features — shipped work

*Rows here are built and verified in the mock backend (`npm run verify` green, web walkthrough 2026-09-30). "Device QA" means real iOS/Android hardware testing, still required before any store claim.*

| Feature | Route(s) | Evidence | Device QA |
|---|---|---|---|
| 8-step onboarding (welcome, goal, stage, date, photo, consent, notify, crafting) → reveal → paywall | `onboarding` | flow + date tests; web walkthrough | pending |
| Today: day/week ring, typical-phase card, next task, band chart (Pro), cohort card, preview + gift cards | `(tabs)/index` | phaseView tests; web walkthrough (day 31 → shed phase) | pending |
| Journey: timeline rail, photo grid (free 3), PRP plan / checkpoints, clinic PDF export (Pro) | `(tabs)/journey`, `journey-setup`, `photo/[id]` | phaseView + report tests | pending |
| Capture with ghost overlay + upright gate (accelerometer) | `capture` | captureGate + guide tests | pending (needs a device) |
| Compare wipe / side-by-side (Pro) | `compare` | compareLogic tests | pending |
| Shed log with 30-day chart | `shed` | shedStats tests; web walkthrough | pending |
| Phase guide ×7 with red flags always visible | `guide/[phase]` | web walkthrough | pending |
| AI preview: style picker, consent, credits, rendering, result wipe, 30-day retention | `(tabs)/previews`, `preview/*`, `consent` | previewFlow + mock server tests; web walkthrough to result | pending (real fal QA) |
| Paywall weekly $7.99 / monthly $12.99 / annual $39.99, no trial; credits store; gift wheel | `paywall`, `credits`, `gift` | plans/credits/wheel tests; mock purchase on web | pending (sandbox) |
| Settings: 20 languages, notifications, data/account deletion, legal | `(tabs)/settings`, `legal/[doc]` | entitlements/errors tests | pending |
| Local reminders (care, phase, photo, shed, PRP) | — | journeyReminders tests | pending |
| Apple system design (light/dark), 20 locales incl. Arabic RTL | all | translation parity (20/20); web RTL check | pending |
| Functions backend (phase B): previews, fal pipeline, credits ledger, RevenueCat webhook, cohort, retention | `functions/` | 116 node tests; 15 rules tests (emulator, Java 23) | not deployed |

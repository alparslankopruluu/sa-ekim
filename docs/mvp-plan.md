# MVP Plan — Kök

*The scope contract. Work happens ONLY inside the current milestone. Ticked only with evidence (tests, screenshots, readbacks). Design: `docs/superpowers/specs/2026-09-29-kok-design.md`. Build phases A → B → C map to M0–M3 below.*

**Current milestone:** M1

## M0 — Scaffold (phase A start)

- [x] Public-only product strategy evidence complete; deterministic Opportunity Score = `go` (76, D-002); honest three-second demo defined (`PRODUCT.md`)
- [ ] `PRODUCT.md`, product map, growth plan, security model, architecture and design direction agree (re-checked after the 2026-09-29 spec review; tick after the final doc audit)
- [x] Project scaffold (Expo SDK 57 / TS strict) + git init + first commit
- [x] i18n skeleton for 20 locales: infrastructure done (`src/translations/<locale>/<ns>.json`, generated typed resources, parity script, ESLint rule); only `en` and `tr` are written, the other 18 follow in M3
- [x] Design tokens + component foundation ("Warm Clinic Noir", Belto-derived components)
- [x] Brand assets (icon, adaptive layers, splash, notification icon) rendered by `scripts/render-brand-assets.mjs`
- [x] Analytics + Crashlytics wired behind the backend ports; `onboarding_start` visible in the mock analytics log
- [x] Anonymous auth on first launch (mock now, Firebase live in phase B)
- [ ] `/factory-setup` doctor green (currently failing: `asc` 4.0.0 unsupported, `maestro` missing, disk under 30 GiB — see decisions D-011)
- [ ] Firebase projects `kok-dev` / `kok-prod`, RevenueCat SDK keys, ASC record — **phase C, owner approval per write**

**Done when:** `npm run verify` is green and the app boots on iOS simulator/web in mock mode. *(web: verified 2026-09-30; iOS simulator build pending)*

## M1 — Core value system, end to end (phase A + B)

- [ ] Journey: operation date → day/week/phase → Today screen with next task, phase card, band chart, offline, in the user's language
- [ ] Capture: ghost overlay + upright gate + weekly cadence; photos device-local; compare (Pro) with wipe and side-by-side; shed log; PRP course plan; clinic PDF (Pro)
- [ ] Guide: seven phases with "what is normal" and red-flag copy in en/tr (then 18 translated); care days free
- [ ] Preview: style picker → consent → upload → progress → result wipe; credits/refunds/idempotency proven in mock tests
- [ ] Reminders: local schedule builder tested (care, phase, weekly photo, shed nudge, PRP); phase and photo reminders gated by Pro at schedule time
- [ ] Cohort card (Pro, opt-in): shows a number only when the real count ≥ 20; otherwise an invitation without a number
- [ ] Core loop instrumented: `core_action_preview`, `photo_captured`, `phase_view`, `shed_logged`
- [ ] Recovery system: empty, loading, offline, rate-limit, provider-failure and retry states designed and tested for every screen
- [ ] Phase B: Functions implement the same callables; 30-day selfie deletion; auto-refund; kill switch; rules IDOR tests
- [ ] Meets the "exceptionally well" bar in `PRODUCT.md`

**Done when:** a new user can set day 0, log photos for weeks in a row, see the right phase text, create a preview, and recover from expected failures without crashes or dead ends.

## M2 — Onboarding + paywall (the money path)

- [ ] 8-step onboarding per spec §6 (welcome, goal, stage, date, photo, consent, notify, crafting) followed by the reveal and the paywall
- [ ] Paywall: weekly $7.99 / monthly $12.99 / annual $39.99, no trial, billed-price-first, disclosure next to CTA, Restore, delayed close, failed/empty states
- [ ] Offerings prefetched at onboarding start — paywall renders instantly
- [ ] Funnel events: `onboarding_start` → `onboarding_step_<n>` → `onboarding_complete` → `paywall_view` → `purchase`
- [ ] Gating matrix enforced by one tested module (`src/lib/entitlements.ts`)
- [ ] Gift wheel + credits store; mock sandbox purchase + Restore verified for every package (real sandbox in phase C)

**Done when:** the funnel is measurable end-to-end in the mock analytics log; sandbox verification follows in phase C.

## M3 — Polish, gates, store, release (phase C)

- [ ] M1 and M2 acceptance recorded; release-candidate UI/content stable; memory docs match the build
- [ ] Engineering-quality gate passes; slow/offline/provider-failure evidence recorded
- [ ] Security-model/data/SDK/permission/privacy parity, IDOR/rate-limit/upload negatives, deployed headers, history secret scan
- [ ] `docs/checklists/performance.md` budgets measured
- [ ] Design QA on every screen in all RTL/LTR and largest Dynamic Type
- [ ] 18 translated locales reviewed by a native pass; native permission strings for all 20
- [ ] Store assets via `/store-assets` (20 locales) — after acceptance
- [ ] `/ship` go/no-go → TestFlight → submission per `docs/checklists/release.md` (review submission needs separate human approval)

## M4 — Published app operations (first 90 days)

- [ ] `/operate-app --mode=plan` cadence per `docs/growth-plan.md`; every publish/notification/review-response mutation previewed and approved

## Scope Fence — explicitly NOT building (protected section)

1. Any diagnosis, Norwood/Ludwig staging, measuring density from photos, or graft-count/price estimates (the illustrative band is a fixed educational curve, not a measurement)
2. Selling or referring users to clinics (lead-gen), clinic dashboards
3. Cloud sync of journey photos, social feed, comments or user-to-user messaging
4. Video previews or 360° tours
5. Ads, third-party ad SDKs, tracking across apps
6. A web app product, Apple Watch, widgets (localized landing pages are backlog/M4 marketing, not app scope)

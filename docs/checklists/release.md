# Release Checklist

*Read this when: running `/ship` or preparing any TestFlight/App Store submission.*

Before running this checklist, get an independent review pass (subagent, second session,
or manual) over the release diff — the implementing session's own memory tends to
rationalize shortcuts away.

## Versioning & build

- Marketing version `MAJOR.MINOR.PATCH` (MINOR features, PATCH fixes). Build number auto-increments (**Expo RN:** EAS `autoIncrement`; **SwiftUI:** `asc builds next-build-number` + `asc xcode inject`).
- Tag `vX.Y.Z` at submission. Release notes drafted from commits, localized for shipped locales.
- Build & distribute — **Expo RN:** EAS production build → download IPA → `asc publish testflight`. **SwiftUI:** `asc xcode archive` → `asc xcode export` → `asc publish testflight`. Use `--wait`; never add App Store `--submit` without separate human approval.
- Uploaded build readback records exact version/build, Processing/Failed/Complete, all
  Complete-state warnings, per-device variant download/install sizes, a 200 MB warning,
  minimum OS/device requirements, and dSYM availability. Build success is not processing
  proof.

## Before you can sell (one-time ASC setup — human does)

- Agreements, Tax, and Banking completed in App Store Connect before the first paid/IAP release — unset banking blocks payouts and can block submission entirely.
- Account Holder has invited team/CI users and assigned least-privilege roles (Admin/App Manager/Developer/Finance) before anyone else can create app records or manage builds.
- An ASC API key generated (Users and Access → Keys) for CI build upload/TestFlight submission instead of Apple ID credentials.
- `asc >=3.1.0,<4` installed; `asc auth login` stores its profile in Keychain; `asc auth doctor` and `asc telemetry disable` completed.
- Node `>=22.12.0` installed (`factoryctl doctor` enforces the same floor for template builds and Worker deploys).
- Apple Developer Program membership is **annual** — set a renewal reminder; a lapsed membership pulls the app from the Store and disables TestFlight.
- **Enroll in the Apple Small Business Program** — drops commission 30% → 15% on proceeds under $1M USD/calendar year (Account Holder accepts it in ASC). Nearly doubles net revenue for a sub-$1M indie app — do this before the first paid release. Exceeding $1M in a year reverts you to 30%; you can re-qualify for 15% the next year if proceeds fall back below $1M.

*Source: developer.apple.com/help/account/, developer.apple.com/help/app-store-connect/, developer.apple.com/app-store/small-business-program.*

## TestFlight ladder

1. **Internal testers** (≤100, no review, live in minutes): every build. 24–48h soak with the smoke list below.
2. **External testers** (≤10,000, one-time Beta App Review per version, builds expire in 90 days): only when a beta pool is needed.

An approved `/factory-run` may upload and distribute to the configured **internal** group automatically. External TestFlight review and App Store review remain separate human approvals.

## Pre-submission verification (Claude runs, human confirms on device)

Start with `docs/checklists/engineering-quality.md`, then verify the app-specific
`docs/security-model.md` and category-risk routes in the rejection rulebook.
When the release diff changes motion, gesture, sheet, transition, or haptic behavior,
run `docs/checklists/motion-quality.md` and `/motion-review diff` before this checklist.

| Check | How |
|---|---|
| Sandbox purchase of EVERY package on the live paywall | sandbox tester, `docs/playbooks/paywall.md` ladder |
| Restore Purchases on a fresh install | delete + reinstall |
| Trial terms displayed == ASC config | visual check adjacent to CTA |
| RC dashboard shows events; webhook → Firestore mirror updates | RC + Firestore console |
| Crash-free ≥ 99.5% on latest TestFlight build | Crashlytics |
| Forced-update path works | bump `min_supported_build` in DEV Remote Config → gate screen + store link |
| Prod project targeted | bundle ID ↔ `GoogleService-Info.plist` match; App Check passing; prod Remote Config template published |
| Analytics events flowing | DebugView spot check of the funnel |
| Performance budgets recorded | `docs/checklists/performance.md` procedure |
| Security gates green | `docs/checklists/security.md` release gates |
| Store assets current | screenshots match current UI/build; Apple growth truth/4+ gate passes; metadata spell-checked all locales; privacy labels accurate |
| Accessibility Nutrition Labels declared in ASC, matching actual support | ASC listing page (`docs/checklists/accessibility.md`) |
| IDOR/rate-limit/upload negative tests and deployed CORS/security headers pass | sanitized `release.validate` evidence |
| Working tree + git-history secret scan clean; suspected exposures rotated | secret-scan/rotation evidence |
| Review notes | demo path described; demo account if any gated content |
| ASC doctor | `asc validate` + `asc review doctor` green; subscription availability, privacy, age rating, export compliance have no blockers |

## Phased release & post-release

- Always enable **Phased Release**: 7-day automatic-update ramp (1→2→5→10→20→50→100%), pausable anytime. New downloads always get the new version — phasing only throttles auto-updates.
- Watch days 1–3: crash-free rate, refund rate, paywall conversion vs baseline, review sentiment. Regression → pause phase, hotfix.
- `min_supported_build` force-update lever: security/billing-critical bugs only.
- Post-approval free levers: promotional text update (no review), In-App Event, review-response pass.

## App Review rejection pre-flight (subscription apps)

- **3.1.2:** paywall missing price/period/auto-renew disclosure; missing functional Privacy Policy + Terms/EULA links in binary AND metadata.
- Missing/broken **Restore Purchases** (must be reachable pre-purchase).
- Misleading trial CTA: "Continue (free)" that starts a paid trial — always "X days free, then $Y/year" adjacent to the CTA.
- **2.1:** crashes on reviewer device/IPv6, placeholder content, onboarding locked behind waitlist/code.
- **5.1.1:** forced account creation for non-account features — anonymous-first (`docs/playbooks/firebase.md`) avoids this.
- **2.3:** screenshots/metadata showing features that don't exist; "also on Android" references.
- **4.3 spam:** template-looking apps — deliberately differentiate design/copy per app; the Design Direction block in `docs/playbooks/design.md` is the mitigation.
- **ATT mismatch** either direction (`docs/checklists/security.md`).
- **1.4.1 (conditional):** if the app claims to measure a health metric (blood pressure, glucose, SpO2, temperature) from phone sensors alone, drop the claim or document a validated accuracy methodology for review — sensor-only vitals claims are auto-rejected.

*Source: App Store Review Guidelines.*

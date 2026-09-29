# App Review Rejection Rulebook

*Read this when: creating a blueprint, preparing TestFlight/store metadata, or running release readiness.*

This is a living prevention system, not a claim that approval is guaranteed. Verify
the current Apple App Review Guidelines before every submission. Each new real rejection
must be anonymized and converted into a reproducible rule with evidence.

## Rule format

Add a row with: guideline, trigger, automated check, manual evidence, last verified
date, and status. Do not add anecdotes, app/user identifiers, reviewer names, or secret
screenshots. A waiver belongs in `docs/decisions.md` and requires explicit user approval.

## Factory gates

| Guideline/risk | Trigger | Automated check | Manual evidence | Last verified | Status |
|---|---|---|---|---|---|
| 2.1 completeness | crash, placeholder, dead endpoint, gated reviewer path, **network call with no timeout/failed-state (a screen stuck on an indefinite spinner reads as broken)** | clean build/tests; IPv6-safe network behavior; links and backend health; no TODO/sample data; **every paywall/purchasable-content fetch has a bounded timeout and a visibly distinct failed/empty state (`docs/checklists/engineering-quality.md`)** | current TestFlight smoke on target devices; review path/account; **force an offerings/network failure and confirm a visible error + retry, not a permanent spinner** | 2026-08-12 | active |
| 2.1 info request (reviewer question) | rejection asks a specific data-handling/functionality question | answer written into the version's App Review Information **Notes field** via `asc review details-update`, readback-confirmed — never only a Resolution Center message reply | `asc review details-for-version` shows the full answer present before resubmitting | 2026-08-12 | active |
| 2.3 accurate metadata | screenshot/copy claims absent behavior or prohibited creative | metadata-feature matrix; real UI; no prices/discounts/URLs/other-platform marks/Apple recognition/unverifiable claims/real-person data; 4+ creative gate | first-three screenshot and exact-build truth check | 2026-08-09 | baseline |
| 3.1.1 digital goods | external purchase/payment routing | scan purchase URLs/copy; products mapped through StoreKit/RevenueCat | every package sandbox purchase | 2026-07-10 | baseline |
| 3.1.2 subscriptions | terms, price/period, renewal, trial, restore absent | paywall disclosure/link/restore assertions; ASC vs RC product/price audit | purchase and restore on fresh install | 2026-07-10 | baseline |
| 4.2 minimum functionality | thin wrapper/static/template | core action quality tests; offline/loading/error states | reviewer can complete valuable core loop | 2026-07-10 | baseline |
| 4.3 spam/copying | cloned name, icon, flow, store copy, template look | name collision/basic trademark check; asset originality; duplicate copy scan | approved original wedge/design artifact | 2026-07-10 | baseline |
| 5.1.1 privacy/account | unnecessary login, no deletion, broken policies, **deletion exists but is undiscoverable** | anonymous-first decision; deletion path/rules tests; live privacy/support URLs; **deletion control lives under a clearly Account-labeled section, not only under Privacy/Data wording** | delete account end-to-end; policy matches data use; **a reviewer scanning Settings for "account deletion" would actually find it under Account** | 2026-08-12 | active |
| 5.1.2 data use | labels/SDK behavior mismatch | SDK and permission inventory; privacy manifest/label diff | ASC App Privacy review | 2026-07-10 | baseline |
| ATT mismatch | tracking behavior and prompt/labels disagree | SDK/config/endpoint scan; ATT branch tests | device prompt/label confirmation | 2026-07-10 | baseline |
| Sign in with Apple | third-party login offered without Apple | provider inventory test | login/link/re-auth/delete flow | 2026-07-10 | baseline |
| Health 1.4.1 | unsupported sensor diagnosis/measurement claim | blocked-claim scan in UI/metadata | validated methodology or claim removed | 2026-07-10 | baseline |
| Kids/safety | children, UGC, sensitive advice | audience/content/SDK/ads moderation checklist | age rating and safeguards reviewed | 2026-07-10 | baseline |
| Export compliance | encryption declaration inconsistent | plist/build/ASC declaration diff | owner confirms actual cryptography use | 2026-07-10 | baseline |
| IAP readiness | missing localization, availability, price, review media | `asc validate iap`; `asc validate subscriptions`; catalog readback | products visible and purchasable in sandbox | 2026-07-10 | baseline |
| Store completeness | missing privacy, age, screenshots, content rights, review info | `asc validate --strict`; `asc review doctor`; metadata and screenshot validation | web-only App Privacy/age fields confirmed | 2026-07-10 | baseline |
| Accessibility | inaccessible core/reviewer flow | automated accessibility tests and checklist | VoiceOver/Dynamic Type/contrast device pass | 2026-07-10 | baseline |

## Blueprint category-risk routing

Record flags in `docs/security-model.md`; every active flag adds its checks before build
and release. `none` is valid only after the data, claims, audience, and SDK inventory is reviewed.

| Flag | Trigger | Required extra evidence |
|---|---|---|
| health | diagnosis, treatment, measurement, HealthKit, wellness claims | claim/source matrix, safety disclaimer, methodology/device capability, HealthKit purpose/data use |
| kids | child audience/content/account/data | age band, parental gate, SDK/ads/data minimization and content safeguards |
| UGC | users publish/share content or contact others | report/block/moderation, abuse response, contact/privacy controls |
| AI | user data leaves app or generated advice/content is shown | provider/data disclosure, consent, safety limits, failure/low-confidence behavior |
| finance | financial guidance, accounts, trading, lending, or money movement | authorization/region limits, claim review, risk disclosure, no misleading outcome promise |
| sensitive-data | precise location, biometrics, contacts, photos, health, identity | necessity, least privilege, retention/deletion, permission and privacy-label parity |

The category pass also produces four artifacts: metadata-feature matrix, complete
permission inventory, SDK/data-to-privacy-label diff, and a reviewer journey with any
demo account/setup. A critical unresolved legal/safety/review risk makes the opportunity
decision `no_go`; the factory cannot waive it by lowering the score.

## Mandatory pre-TestFlight checks

- No secrets, debug menus, test endpoints, sample credentials, placeholder/legal URLs,
  or development Firebase/R2 target in the production build.
- App launches after fresh install, survives offline/slow/failure states, and exposes
  a useful core path without unnecessary registration.
- All selected locale strings, permission reasons, paywall copy, metadata, IAP names,
  and screenshots exist; Arabic RTL and truncation are visually checked.
- Weekly/annual product IDs equal RevenueCat store identifiers; `pro`, offerings,
  packages, price, availability, and trial terms reconcile by readback.
- Privacy/terms/support URLs return 200 over HTTPS and describe actual data, account
  deletion, subscription terms, and contact route.
- Screenshot features exist in the uploaded build; icon/name/metadata are original.
- Icon Composer, when used, has verified macOS/Xcode/tool versions, Default/Dark/Mono,
  small-size legibility, and Xcode integration; otherwise the opaque 1024x1024 sRGB
  fallback is used.
- Metadata-feature matrix, permission inventory, privacy-label diff, reviewer journey,
  and category-specific evidence match the exact uploaded build.

## Mandatory pre-review checks

Internal TestFlight is not review submission. Before a separately approved submission:

1. Complete a 24–48 hour internal soak and the device-only purchase/restore/delete tests.
2. Run `/ship`, `asc validate --strict`, `asc review doctor`, digital-goods validation,
   security, performance, accessibility, and metadata/assets checks.
3. Confirm Agreements, Tax, Banking, age rating, App Privacy, content rights, export
   compliance, review contact, demo path/account, and notes in App Store Connect.
4. Ensure no approved blueprint assumption changed after the TestFlight build.
5. Obtain explicit user approval for the exact version/build review submission.

## Learning loop

After a rejection, save only anonymized facts: guideline/message summary, build/version,
trigger, root cause, fix, regression check, and verification date. Add or strengthen one
automated check; link its evidence. Never encode a workaround that misleads review or
weakens privacy, security, payment, or product quality.

Primary sources: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app).

## Logged rejections

Anonymized facts only (no app name, submission ID, bundle ID, contact info, or reviewer name).

- **2026-08 round 1 — first submission.** Guidelines hit together: **2.1(b)** app completeness
  ("the app includes references to [subscription products] but the associated In-App Purchase
  products have not been submitted for review" — IAP products must be submitted alongside the
  binary, not created and left un-submitted) and **2.1** face-data info request (see the
  question list below). Root cause: IAP products existed in ASC but were never moved past
  "Missing Metadata" (needs an App Review screenshot before it's submittable), and the
  face-data disclosure lived only in the Privacy Policy, never restated to App Review directly.
  Fix: attach an App Review screenshot to each subscription/IAP (`asc subscriptions review
  screenshots create` / `asc iap review-screenshots create`) so it reaches "Ready to Submit";
  answer the face-data questions in full. Verified 2026-08-07.

- **2026-08 round 2 — same face-data question repeated.** Root cause: round 1's answer was
  sent only as a message reply, never written into the version's Notes field — see the new
  "2.1 info request" row above. Fix and verification: see that row.

- **2026-08 round 2 — new issues on resubmission.** **2.1(b)** "The In-App Purchase products
  in the app exhibited one or more bugs which create a poor user experience. Specifically, the
  app failed to load the pro features." Root cause and fix: see the strengthened "2.1
  completeness" row above (silent-failure offerings fetch, no timeout/failed-state). **5.1.1(v)**
  "The app supports account creation but does not include an option to initiate account
  deletion." Root cause and fix: see the strengthened "5.1.1 privacy/account" row above
  (deletion existed, was undiscoverable). Verified 2026-08-12.

### Reference: recurring message patterns (Apple's own standard wording)

Useful to recognize verbatim in a real rejection — these are Apple's boilerplate, not
app-specific, reproduced here so a blueprint author spots the pattern immediately instead of
treating each rejection as novel:

> **Guideline 2.1 - Information Needed** (face/biometric data): "We need additional
> information about how the app uses face data... Provide complete and detailed responses to
> the following questions: What face data does the app collect? Provide a complete and clear
> explanation of all planned use, sharing, retention, deletion, and storage practices... Will
> the face data be shared with any third parties? Where will this information be stored? How
> long will face data be retained? Where in the privacy policy is the app's collection, use,
> disclosure, sharing, and retention of face data explained?... Quote the specific text from
> the privacy policy concerning face data."
> → Answer every sub-question explicitly, name the exact policy section per answer, quote the
> live policy text verbatim (never paraphrase), and place the full answer in the Notes field.

> **Guideline 2.1(b) - Performance - App Completeness** (IAP not submitted): "the app includes
> references to [X] but the associated In-App Purchase products have not been submitted for
> review... Note you must provide an App Review screenshot in App Store Connect in order to
> submit In-App Purchases for review."
> → Every IAP/subscription referenced in the binary must reach "Ready to Submit" (screenshot
> attached) before submitting the app version, not just exist in ASC.

> **Guideline 2.1(b) - Performance - App Completeness** (functional bug): "The In-App Purchase
> products in the app exhibited one or more bugs which create a poor user experience.
> Specifically, the app failed to load [core paid feature]... Apple reviews In-App Purchase
> products in the sandbox and the In-App Purchase products do not need prior approval to
> function in review."
> → This is a real functional bug report from a live device, not a metadata gap — reproduce it
> (force a slow/failed offerings fetch) before assuming it's a review-environment fluke.

> **Guideline 5.1.1(v) - Data Collection and Storage** (account deletion): "The app supports
> account creation but does not include an option to initiate account deletion... Only offering
> to temporarily deactivate or disable an account is insufficient... reply to this message with
> a screen recording captured on a physical device that demonstrates: Creating a new account or
> signing in with the demo account, Navigating to the account deletion option, The complete
> account deletion flow from initiation to confirmation."
> → Existence isn't enough — it must be reachable from where a reviewer would naturally look
> (an Account-labeled section), and a repeat/future submission may need a physical-device screen
> recording attached as proof, which is a human-only step (Claude cannot produce it).

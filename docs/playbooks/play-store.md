# Native Android and Google Play

*Read this when: planning, building, testing, listing, or shipping any Android app. Native
iOS parity uses Kotlin/Jetpack Compose under `android/`; EAS applies only to an explicitly
selected or established Expo project.*

## Delivery contract

Android parity preserves the iOS product promise, user outcome, backend/data contracts,
analytics names, and monetization truth without pixel-copying SwiftUI. Use Material 3,
adaptive layouts, edge-to-edge, predictive back, and TalkBack-native semantics. The
canonical scope and exceptions live in `docs/android-parity.md`.

| Target | Completion evidence |
|---|---|
| `local` | Minified prod release AAB built, bundletool-validated/installed, money-path smoke passed |
| `internal` | `local` plus exact Play Internal Testing application ID/versionCode/track/status/tester readback |
| `production-ready` | `internal` plus validated listing, Data Safety, production-access and staged-rollout drafts; nothing submitted |

Production publication, closed/open-track rollout, pricing changes, Data Safety
submission, app/developer verification, and signing-key actions always require a fresh
human approval. Prior blueprint or internal upload approval never implies production.

## Native baseline

- Kotlin + Jetpack Compose + Material 3; Navigation 3 stable; coroutines/StateFlow with
  unidirectional state and MVVM; Hilt; Gradle Kotlin DSL, version catalog, and convention
  plugins.
- Default `minSdk=26`, `targetSdk=36`, compile SDK no lower than target. From 31 August
  2026, new apps and updates must target Android 16/API 36 or higher, subject to Google's
  documented form-factor exceptions. Re-check before every upload:
  <https://support.google.com/googleplay/android-developer/answer/11926878>.
- Modules start with `:app`, `:core:model`, `:core:designsystem`, `:core:data`,
  `:feature:core`, `:feature:onboarding`, and `:feature:paywall`; add only features proven
  shipped on iOS. Do not introduce KMP or Compose Multiplatform.
- Room is conditional on structured offline/history data, DataStore owns preferences,
  and Retrofit/OkHttp is added only for a real REST contract. Keep repositories at data
  boundaries and business logic out of composables.

Official architecture reference:
<https://developer.android.com/topic/architecture/recommendations>.

## Listing package

Canonical Play assets live under `fastlane/metadata/android/<play-locale>/`; locale
mapping is explicit rather than assumed from ASC codes.

| Asset | Current kit requirement |
|---|---|
| Title | ≤30 characters |
| Short description | ≤80 characters, benefit-led |
| Full description | ≤4000 characters, natural keyword relevance |
| Feature graphic | 1024×500 JPEG/24-bit PNG, opaque; required |
| Icon | 512×512 PNG, opaque |
| Phone screenshots | 2–8, each side 320–3840 px, max side ≤2× min side, JPEG/24-bit PNG without alpha |
| Tablet screenshots | Only when 7"/10" adaptive UI is genuinely implemented and verified |

The first two screenshots carry distinct benefits and the third proves the real core
flow. Use Android-native frames and real verified states; never stretch iOS screenshots
or show a parity item still pending. `fastlane supply` is the existing metadata/graphics/
track transport baseline. Inspect installed help, validate/preview the immutable delta,
obtain approval, apply, then read back. Never infer authority from a generated Fastlane
directory.

## Firebase, purchases, and Data Safety

- Register Android dev/prod apps in the same Firebase projects as iOS. Preserve Firestore
  schema/rules, Functions, Remote Config keys, and analytics event names; verify Auth,
  Crashlytics, Performance Monitoring, FCM, and App Check integration independently.
- Use Play Integrity as the App Check provider only when supported and documented by the
  threat model. Integrity verdict enforcement, certificate pinning, and device exclusion
  are risk decisions—not blanket defaults.
- Keep RevenueCat entitlement `pro` and offerings `default`/`onb_discount`. Create/import
  Play products with matching semantic IDs and reconcile audit → approved apply →
  RevenueCat/Play readback. Purchases remain behind the one service wrapper; test
  purchase, restore, cancellation/expiry, offline, and account-switch recovery.
- Draft Data Safety from the actual SDK/data inventory: collection, sharing, purpose,
  optionality, retention/deletion, encryption, account deletion, identifiers, diagnostics,
  purchases, usage data, and user content. Never copy an iOS privacy label mechanically;
  a human reviews and submits the form.

`google-services.json` is client configuration rather than a provider secret, but the kit
keeps environment-specific files out of source by default and injects them locally/CI.
Service-account JSON, RevenueCat secret keys, upload keystores/passwords, auth headers,
and Play credentials never enter the repo, prompt, `.factory` state, logs, or evidence.

## Security and release optimization

- Disable cleartext traffic. Explicitly classify every exported activity/service/
  receiver/provider; constrain permissions and verify untrusted intents, app links,
  WebView navigation, files/content URIs, PendingIntents, and notification actions.
- Store local sensitive material with Android Keystore-backed APIs; prefer Credential
  Manager for supported sign-in flows. Client entitlement flags are never authoritative.
- Prod release must be non-debuggable and use R8 full mode with minification,
  obfuscation, and resource shrinking. Keep rules are evidence-driven and minimal; test
  reflection/serialization/DI/Firebase/RevenueCat paths in the minified artifact.
- Preserve `mapping.txt` as protected release evidence and verify deobfuscation upload to
  Play/Crashlytics. Run a minified device smoke before any upload. Official optimization
  guidance: <https://developer.android.com/topic/performance/app-optimization/enable-app-optimization>.
- Run Android Lint, Detekt/Compose rules, dependency/license checks, unit tests, Compose
  UI tests, Roborazzi goldens, TalkBack semantics, Macrobenchmark, and Baseline/Startup
  Profile checks. Capture cold/warm startup and frame-jank numbers against project budgets.

## AAB and Internal Testing

1. Confirm a clean source commit/digest and all in-scope parity rows verified/approved
   exception. Resolve human gates for Firebase, RevenueCat, signing, and Play identifiers.
2. Run the project's unit/UI/screenshot/lint/Detekt/performance gates. Native parity uses
   `cd android && ./gradlew bundleProdRelease` after confirming actual task names;
   established Expo uses its approved production Android/EAS build and remains Expo.
3. Use `bundletool` to validate the AAB, generate a device-specific APK set, install it,
   and execute the minified onboarding → paywall → purchase/restore money-path smoke.
   Record AAB digest, application ID, versionName/versionCode, size, mapping, and tests.
   Reference: <https://developer.android.com/guide/app-bundle/test>.
4. Audit Play state and show the exact Fastlane Supply internal-track command/delta. The
   Android blueprint authorizes local implementation only; Internal Testing upload needs a
   separate exact approval after this preview. A standing no-write instruction always wins.
5. Read back application ID, versionCode, `internal` track, release status, artifact, and
   tester/opt-in availability before marking delivery complete. Internal builds are URL-
   only and not publicly discoverable.

New personal developer accounts created after 13 November 2023 currently need a closed
test with at least 12 opted-in testers for 14 continuous days before applying for
production access. This is distinct from the kit's Internal Testing handoff and must be
re-verified at planning time:
<https://support.google.com/googleplay/android-developer/answer/14151465>.

Review Play pre-launch reports for stability, compatibility, performance, accessibility,
and security before widening a test. Test-track reference:
<https://support.google.com/googleplay/android-developer/answer/9845334>.

## Signing, rollout, and authority split

- Use Play App Signing. Generate/protect the upload key outside the repo; record only
  non-secret certificate SHA-1/SHA-256 where Firebase/Auth configuration requires them.
  Key creation, recovery, reset, export, and rotation are human gates.
- Prepare a staged production rollout proposal (normally 5–10% first, with explicit
  crash-free, ANR, refund, and purchase-success thresholds). A human selects each rollout
  percentage and approves every increase or halt after fresh telemetry readback.
- Never automatically create a Play app, accept agreements, complete developer
  verification, attach billing, recruit testers, submit Data Safety, change pricing,
  publish production, or delete/replace a release.

| Agent prepares/verifies | Human explicitly controls |
|---|---|
| Parity matrix, Compose implementation, tests/performance/R8 evidence, localized listing/graphics, Data Safety draft, Fastlane structure/preview, product-ID reconciliation, AAB validation, approved internal upload readback | Play account/app UI gates, developer verification, tester recruitment, signing/upload-key operations, Data Safety submission, billing/pricing, production-access application, closed/open/production rollout and percentages |

All external writes follow audit/read → preview → exact approval → apply → readback.
Reverse-engineering skills are not used to port an iOS source app. They are allowed only
for an Android artifact the user owns or is authorized to analyze, with explicit legal
scope and no copying of third-party code, endpoints, credentials, or trade dress.

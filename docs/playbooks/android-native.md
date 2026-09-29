# Native Android stack contract

*Read this for every Kotlin/Compose change created by `/port-android`. The product and
backend contracts remain shared; this file owns Android implementation conventions.*

## Baseline

- Kotlin, Jetpack Compose, Material 3, stable Navigation 3, Gradle Kotlin DSL, version
  catalog, coroutines/Flow, ViewModel + unidirectional data flow, and Hilt.
- `minSdk = 26`, `targetSdk = 36`, and a stable `compileSdk >= targetSdk`. Use stable AGP,
  Kotlin, Compose BOM, and AndroidX artifacts resolved from official release sources; do not
  put an alpha/canary dependency in the production graph without explicit approval.
- Start from the official Android CLI `empty-activity-agp-9` template after reviewing
  `android create --dry-run --verbose`; scaffold inside `android/`, never over iOS source.
- Modules: `:app`, `:core:model`, `:core:designsystem`, `:core:data`, `:feature:core`,
  `:feature:onboarding`, `:feature:paywall`, plus only shipped feature modules in the parity
  contract. Dependencies point from app/features toward core abstractions, never feature to
  feature. Keep implementations `internal` unless a real cross-module consumer exists.

## UI and state

- Preserve product outcome and brand tokens, not SwiftUI pixels. Use adaptive Material 3,
  edge-to-edge, predictive back, window-size classes/panes, dark/light themes, font scaling,
  48dp touch targets, TalkBack semantics, and reduced-motion/system animation settings.
- Expose immutable screen `UiState` through `StateFlow`; collect lifecycle-aware. Model
  durable state separately from one-shot effects. Never launch business work from a
  composable body or keep Activity/Context in a ViewModel.
- Put data access behind repositories. Add a domain use case only when logic is shared by
  multiple ViewModels or is independently complex. Use DataStore for preferences and Room
  only for structured offline/history data selected by the parity contract.
- Use official platform pickers, sharesheet, permissions, Credential Manager, Keystore,
  notifications, and media APIs. Every iOS-only integration needs an explicit mapped row in
  `docs/android-parity.md`.

## Backend, observability, and money

- Register Android in the same Firebase dev/prod projects. Keep Firestore/Functions schema,
  ownership rules, event names, Remote Config keys, and privacy semantics cross-platform.
- Wire Auth, App Check (Play Integrity only where threat-model justified), Analytics,
  Crashlytics, Performance Monitoring, Remote Config, and FCM. Verify a non-fatal, a forced
  dev crash, startup/core traces, and one DebugView event before release.
- Use RevenueCat as the only client purchase boundary. Preserve entitlement `pro` and
  offering semantics, map Play product identifiers explicitly, and test purchase/restore
  using license testers. Views never call the SDK directly.
- Paid APIs and privileged mutations remain behind authenticated, App-Check-protected server
  code. Do not recover or copy endpoints from a binary when owned source/contracts exist.

## Security and release optimization

- Disable cleartext traffic. Declare every exported component deliberately, validate inbound
  intents/deep links, use narrow URI grants, redact logs, and keep secrets/service-account
  JSON/upload keystores outside the repository and factory state.
- Do not add certificate pinning, local root checks, or Play Integrity as security theater;
  require a threat, recovery/rotation path, server verdict policy, and negative tests.
- Release enables R8 full mode, minification, obfuscation, and resource shrinking. Keep rules
  must be evidence-based and as narrow as possible. Test the minified artifact, retain/upload
  mapping files through approved channels, and run the official R8 analyzer before release.
- Generate Baseline and Startup Profiles from the core journey. Gate cold/warm startup,
  frame jank, ANR/crash behavior, bundle size, background/battery behavior, and Play Vitals.

## Required commands and evidence

Use the checked-in Gradle wrapper:

```bash
cd android
./gradlew testProdDebugUnitTest lintProdDebug detekt
./gradlew connectedProdDebugAndroidTest
./gradlew verifyRoborazziProdDebug
./gradlew :baselineprofile:connectedBenchmarkAndroidTest
./gradlew bundleProdRelease
```

Confirm actual task names with `./gradlew tasks`; never invent a green result. Validate the
AAB with bundletool and install/test a minified universal APK on an emulator/device before
any approved Internal Testing upload.

---
description: Port an owned shipped SwiftUI app to native Kotlin/Compose and Play Internal Testing
argument-hint: [--scope=core|shipped|planned] [--through=local|internal|production-ready] [--resume]
---

Port this owned iOS app to native Android for: **$ARGUMENTS**

Default to `--scope=shipped --through=internal`. Accept only the documented enum values or
`--resume`; resume rejects new scope/through options and uses `.factory/android-state.json`.
Read `docs/playbooks/android-port.md`, `android-native.md`, `android-expert-tools.md`,
`play-store.md`, the chosen iOS `docs/stack.md`, and applicable security/performance/release,
Firebase, RevenueCat, design, onboarding, paywall, localization, and analytics documents.

## Establish the owned source baseline

Require real SwiftUI source/project markers, `PRODUCT.md`, product map, features, architecture,
data/security/growth docs, MVP plan, tests, and Git evidence. Run the repository's safe iOS
build/tests. Product/build/test failures block implementation; environment/tool failures become
explicit human gates and never count as shipped proof. Use a clean commit; if dirty, inventory user-owned
changes and obtain explicit approval before using a redacted working-tree digest. Never reset,
stash, overwrite, or reverse engineer a binary to compensate for missing owned source.
Route missing or stale canonical memory to `/continue-app` or `/update-docs`; never infer
full parity from screenshots or a binary.

On a new run execute `python3 scripts/factoryctl.py android init --scope <scope> --through
<through>`; on resume use `python3 scripts/factoryctl.py android resume`. Never replace an
existing Android state and never mutate the existing factory run-state. Queue and
transition the canonical task graph from the playbook, attaching only local redacted
evidence.

## Contract before code

Reconcile code and canonical docs into `docs/android-parity.md`. Preserve user outcome, brand
tokens, content hierarchy, analytics/data schemas, entitlement/offering semantics, error and
offline states, accessibility, and measurable acceptance. Map each iOS-only API to an
Android-native substitute, a user-approved exception, or a blocker. Do not pixel-copy SwiftUI
or add planned features under `shipped`.

At most three secret-free agents may independently inventory features/screens, map Android UX,
and audit backend contracts. Root merges the contract and owns code, state, approvals, builds,
providers, signing, assets, and Play. Show one blueprint containing modules, dependencies,
platform mappings/exceptions, exact Firebase/RevenueCat/Play writes, evidence, and delivery
boundary. Obtain blueprint approval before feature code. That approval covers local
implementation only and never authorizes provider or Play writes.

## Build and verify locally

Run the Android doctor. Install/configure nothing silently. Review the official Android CLI
dry run, then scaffold only inside `android/`. Implement the modular Kotlin/Compose stack from
`android-native.md`; retain iOS source. Use the same dev/prod backend and event contracts,
RevenueCat `pro` semantics, recovery states, localization, and privacy promises.

Verify unit, Compose UI, Roborazzi, accessibility, lint/Detekt, dependency/license, StrictMode,
Macrobenchmark/Baseline Profile, startup/frame/ANR, and minified R8 release behavior. Require
full-mode R8, resource shrinking, narrow keep rules, mapping handling, bundletool validation,
and a minified emulator/device smoke before considering the AAB valid.

For `local`, stop after the verified release AAB. For `internal`, preview exact provider and
Play actions; obtain a separate exact approval for each Firebase/RevenueCat mutation and for
the Play upload, then use audit/dry-run -> apply -> readback for Firebase Android registration,
RevenueCat Play products, Play assets, and Internal Testing. Blueprint approval never supplies
these approvals and a standing no-write instruction always wins.
For `production-ready`, also prepare reviewed listing, Data Safety, pre-launch remediation,
and rollout drafts. Never submit production, change price/rollout, expose a service-account
file, persist signing/provider secrets, or run an unscoped deploy. If external writes are
frozen, keep the immutable delivery target, add a waiting-human gate, stop after local
evidence, and never silently downgrade to `local` or mark the Android run complete.

Refresh `/factory-next` at checkpoints. Mark `port-android` done only when the selected
delivery boundary and parity acceptance pass. Output an `ANDROID PORT REPORT` with source,
scope, parity counts/exceptions, tests, security/performance/R8, Firebase/RevenueCat, AAB,
Play readback, human actions, production `NOT SUBMITTED`, and next exact action.

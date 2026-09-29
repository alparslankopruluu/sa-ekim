---
description: Cross-platform pre-release go/no-go, verified internal distribution, and submission handoff
argument-hint: "[--platform=ios|android|both]"
---

Run the full pre-release gauntlet for `$ARGUMENTS` and produce a **go/no-go report**.
Parse only `--platform=ios|android|both`. Explicit selection wins; otherwise detect native
Android Gradle files, Xcode project/workspace, or an established Expo config. Select
`both` only when both deliverables exist; ask if ambiguous. Set
`python3 scripts/factoryctl.py run stage release` and refresh recommendations. A lifecycle
marker authorizes no distribution or review/production submission.

## Shared gates

1. If running under Claude Code, spawn the `preship-diff-reviewer` subagent to review,
   with no memory of the implementing session, the diff since the last shipped milestone
   against CLAUDE.md §4, `docs/security-model.md`, and the checklists below; fold its
   findings into the gates and the final report rather than re-deriving them from the
   implementing session's own memory.
2. Run `docs/checklists/performance.md` and record every number against its budget.
3. Run `docs/checklists/engineering-quality.md`; reconcile `docs/security-model.md` with
   actual SDK/data/permission behavior; complete `docs/checklists/security.md`, including
   IDOR/rate-limit/upload negatives, CORS/headers, git-history secret scan, safe errors,
   and dependency/privacy/permission drift.
4. **Motion (conditional):** if motion/gesture/haptic behavior changed, run
   `/motion-review diff` and `docs/checklists/motion-quality.md`; otherwise report `N/A`.
5. Verify accessibility, localization, purchase recovery, offline/error states,
   analytics, and real-device-only checks for each selected platform. A failure on one
   platform cannot be hidden by success on the other.
6. Confirm screenshots and metadata describe the exact build; run
   `/store-assets --platform=<selected>` when stale. Apply the Documentation Update Table
   or `/update-docs` before reporting.

## iOS gate

Read `docs/checklists/release.md`, `docs/playbooks/app-store-connect.md`, and, for
SwiftUI, `docs/playbooks/ios-expert-tools.md`. Run only installed focused reviewers that
match the release diff; missing optional skills are `N/A`. Axiom remains explicit beta
opt-in for a targeted evidence gap—never a broad health-check.

Run `asc auth doctor`, `asc validate`, and `asc review doctor`. Use
`asc-submission-health` only for readiness and `asc-testflight-orchestration` only for an
approved internal distribution. Build/export per stack, then use
`asc publish testflight --wait` with the configured internal group/tester only within an
approved blueprint; otherwise report the exact dry-run action. Never add `--submit` or
submit for App Store review without a separate human approval.

Read back the uploaded build itself: exact marketing version/build,
Processing/Failed/Complete state, every warning even when Complete, per-device variant
download/install sizes, any 200 MB cellular concern, minimum OS/device requirements, and
dSYM availability. Xcode/EAS success alone is not App Store processing proof.

## Android gate

Read `docs/playbooks/play-store.md` and `docs/android-parity.md`. Native parity must stay
Kotlin/Jetpack Compose; EAS is valid only for an explicitly selected/existing Expo app.

1. Require every in-scope parity row to be `verified` or an explicitly approved
   `exception`. For native parity, verify `minSdk=26`, `targetSdk=36`, compile SDK ≥ target,
   Material 3 adaptive/edge-to-edge behavior, predictive back, and TalkBack semantics.
   For established Expo, enforce current Play target policy and its approved stack
   contract without converting it to native during release.
2. Native parity runs unit and Compose UI tests, deterministic Roborazzi coverage,
   Android Lint, Detekt/Compose rules, dependency/license checks, Macrobenchmark and
   Baseline/Startup Profile verification. Established Expo runs its documented Jest/
   Maestro/lint/typecheck/performance equivalents. Exercise deep links, offline/error/
   paywall/purchase recovery on a minimum-supported and representative current device.
3. Inspect the prod release variant: R8 full mode, minification, obfuscation, and resource
   shrinking are mandatory; keep rules must be minimal. Require a generated mapping file,
   minified smoke test, readable Crashlytics deobfuscation path, and no debug logging or
   debuggable release.
4. Verify cleartext is disabled, exported components and incoming intents are constrained
   and tested, WebView/deep-link inputs are validated, provider secrets/service-account
   JSON/upload keystore never enter repo/state/logs, and signing/App Check/Play Integrity
   choices match the threat model. Read back Firebase Android registrations and RevenueCat
   `pro` entitlement/offering/Play-product parity without exposing credentials.
5. Native parity runs `cd android && ./gradlew bundleProdRelease` after confirming the
   task names; established Expo uses its approved production Android/EAS build. Validate
   the resulting AAB with `bundletool`, install the generated split APK set on a target
   device, and run the minified money-path smoke test. Record AAB digest/versionCode,
   mapping evidence, size, and test results.
6. Use Fastlane Supply as the Play transport baseline. The default Android handoff targets
   Internal Testing; upload only under the approved Android blueprint, then read back the
   exact application ID, versionCode, track, release status, and tester availability.
   Play app creation, developer verification, Data Safety submission, upload-key creation,
   pricing, and any production/closed/open rollout remain precise human gates.

`local` Android delivery stops after the verified release AAB. `internal` stops after
Internal Testing readback. `production-ready` additionally prepares validated listing,
Data Safety, production-access, and rollout drafts but never sends them. Honor the target
stored by `/port-android`; if no Android state exists, the default requested delivery is
`internal`, with upload still approval-gated. Production publication always requires a
new approval regardless of state or prior blueprint.

## Report and completion

```text
SHIP REPORT — ios|android|both — vX.Y.Z (build/versionCode N)
✅/❌ per platform gate, with measured numbers and evidence
PARITY: verified / exception / pending
BLOCKERS: …
GO / NO-GO: …
Distribution readback: …
Next human steps: …
```

Any failure blocks its platform unless explicitly waived and recorded in
`docs/decisions.md`; security, payment truth, signing, target API, R8, and parity blockers
cannot be silently waived. When all selected local reliability/security/payment/release
gates pass, mark `reliability-review` done. Mark `ship` done only after the selected
approved distribution acceptance criteria pass. Prepare the M4 handoff without publishing
promotion; a non-public build remains waiting for release readback.

Before the final report, refresh/list recommendations and append at most three next
actions, ten TODOs, role/risk/delegation, and pending approvals. A NO-GO suppresses
promotional suggestions.

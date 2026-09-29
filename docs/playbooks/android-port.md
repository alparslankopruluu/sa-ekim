# Native Android parity run

*Read when running `/port-android`, resuming an Android port, or changing its orchestration.*

## Gates and task graph

1. **Owned source gate:** require a real SwiftUI app, canonical product docs, and a passing
   source build/test baseline. Product/build/test failures block parity implementation;
   environment/tool failures become explicit human gates and never count as shipped proof.
   Record a clean Git revision; a dirty digest requires explicit
   approval. No source means route to `/continue-app`/`/update-docs`, not binary extraction.
2. **Parity contract:** inventory shipped screens/features, states, events, data, purchases,
   permissions, native integrations, accessibility, and tests into `docs/android-parity.md`.
   `core` selects core/onboarding/paywall, `shipped` selects all proven behavior, and
   `planned` additionally requires an explicit scope approval.
3. **Blueprint approval:** show modules, platform substitutions/exceptions, dependencies,
   Firebase/RevenueCat/Play writes, store work, acceptance evidence, and delivery boundary.
   Before approval perform reads and local documentation only. Approval authorizes local
   implementation, not provider mutations, upload, pricing, rollout, or production.
4. **Local implementation:** doctor tools, preview/scaffold `android/`, then implement design
   system, core data/backend contracts, shipped features, onboarding/paywall, recovery,
   analytics, accessibility, and tests in dependency order.
5. **Quality/release:** test debug and minified release, run security/performance/R8 gates,
   create Android store assets, validate the AAB, and stop at `local` when selected.
6. **Play:** after separate exact approvals for each Firebase/RevenueCat mutation and the
   Play upload, use audit/dry-run -> apply -> readback for Firebase Android registration,
   RevenueCat Play catalog, and Play Internal Testing. For
   `production-ready`, prepare listing, Data Safety, pre-launch findings, and rollout plan;
   never submit production or change rollout/pricing automatically.

Queue tasks in this order: `android.audit` -> `android.contract` -> `android.tools` ->
`android.scaffold` -> `android.backend` -> `android.core` -> `android.money` ->
`android.quality` -> `android.performance` -> `android.assets` -> `android.internal`.
Skip only tasks outside the selected delivery boundary; never mark them succeeded.

## Delegation

At most three independent, secret-free agents may inventory iOS behavior, map Android UX, or
audit backend contracts. Give each one output/file bounds and acceptance criteria. Android
Studio/ADB/Gradle builds, integration, `.factory` state, provider access, signing, assets,
and Play writes stay local under the root agent.

## External and legal boundary

- The invocation is not approval for Firebase/RevenueCat/Play writes, signing, upload, spend,
  price changes, staged rollout, or production submission.
- Blueprint approval never overrides a standing no-write instruction. Preserve the immutable
  delivery target, stop after local evidence, and record a waiting-human gate rather than
  silently downgrading to `local` or claiming completion.
- Preserve product behavior and original brand assets owned by this project; do not imitate
  Android competitors or decompile third-party APKs. Public references inform conventions,
  never protected expression.
- Never persist upload keystores, service-account JSON, OAuth tokens, session cookies,
  `google-services.json`, signing passwords, or raw provider payloads in chat/state/evidence.

## Completion

`local` completes with parity/quality gates and a validated release AAB. `internal` also
requires Play Internal Testing artifact/track/version readback. `production-ready` adds
reviewed listing/Data Safety/rollout drafts, but production remains `NOT SUBMITTED`.

Report source revision, scope/boundary, parity verified/pending/exceptions, Android build and
test evidence, Firebase/RevenueCat status, R8/performance/security proof, AAB identity, Play
readback, human actions, active minutes, and the exact next action.

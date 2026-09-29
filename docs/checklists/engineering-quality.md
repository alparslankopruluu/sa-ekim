# Engineering Quality

*Read before changing architecture or a core flow, and at every `/ship`. Apply SOLID at change/test boundaries; do not manufacture abstractions.*

## Structure and dependencies

- Feature modules depend inward on domain/service contracts; provider SDKs stay behind one façade.
- SwiftUI services that cross a network/provider boundary are protocol-backed and injected. Expo services expose strict typed functions/hooks; screens never call provider SDKs directly.
- Views/components render state and send intents. Business rules, purchases, persistence, retries, and analytics orchestration live outside the view.
- Reuse before adding. Promote a helper only when a second consumer proves the shared abstraction.
- A one-implementation leaf helper does not need an interface merely to look “SOLID.”

## Resilience contract

- Define typed errors users and telemetry can distinguish; never expose raw provider errors or secrets.
- Every network operation has cancellation and a documented timeout. Retry only idempotent/transient operations with a cap and backoff.
  **Never let "still loading" and "permanently failed/empty" render as the same indefinite
  spinner** — a real 2026-08 rejection (2.1(b), "app failed to load the pro features") traced
  to exactly this: an offerings/paywall fetch used a silent-failure pattern (e.g. Swift `try?`
  discarding the error) with no timeout, so a slow/failed network call left the paywall
  spinning forever with no error and no retry. Any screen gating purchasable content or a
  core action behind a network/SDK call needs a bounded timeout race plus a visibly distinct
  failed/empty state with a retry action — see `docs/playbooks/paywall.md`.
- External mutations use stable idempotency keys or audit/readback protection where supported.
- Core screens have loading, empty, offline, permission-denied, partial-data, and recoverable error behavior in `docs/product-map.md`.
- Firestore/model schema changes include backward compatibility, migration/read repair, and rollback notes in `docs/data-model.md`/`docs/decisions.md`.

## Verification and operations

- Unit-test domain rules and ViewModels/hooks with mocked boundaries; integration-test rules/functions/adapters; E2E-test onboarding → paywall → purchase/restore and the core loop.
- CI runs build, lint/format check, typecheck/compile, tests, locale parity, secret scan, and applicable Firebase rules tests.
- Crashlytics and performance traces identify release/build and sanitized operation names; no PII, tokens, request bodies, or raw provider output.
- Verify dependency audit, pinned lockfiles/resolved packages, privacy manifests, permission inventory, and unused dependency/permission removal.
- Verify dependency vulnerability output and permission/privacy-manifest drift against
  the exact release lockfile/build, not only package declarations.
- Exercise slow/offline/provider-failure paths and confirm a useful degraded state before release.

## Release gate

Any failure above blocks `/ship` unless the user records a scoped, dated waiver in
`docs/decisions.md` with impact, mitigation, owner, and expiry.

# Analytics

*Read this when: adding events, KPIs, or experiment instrumentation. If it isn't measured, it didn't happen.*

## Taxonomy (snake_case, no exceptions)

| Event | Params | Fires |
|---|---|---|
| `onboarding_start` | — | welcome screen appears |
| `onboarding_step_<n>` | `step_name` | each onboarding screen |
| `onboarding_complete` | `duration_s` | last pre-paywall step done |
| `paywall_view` | `source` (onboarding, settings, locked_feature…), `offering` | paywall visible |
| `paywall_dismiss` | `source`, `viewed_s` | closed without purchase |
| `trial_start` | `package` | trial begins |
| `purchase` | `package`, `is_renewal` | any purchase |
| `core_action_{{CORE_ACTION}}` | app-specific | THE core loop action |
| `core_action_failed` | `reason` (offline, rate_limited, provider, validation), `retryable` | core action cannot complete |
| `retention_value_viewed` | `surface` | user sees the approved return-value surface |

- User properties: `subscription_status` (free / trial / pro / churned), `onboarding_variant`.
- New events are added to THIS table in the same change (Doc Update Table in CLAUDE.md).
- Project-specific events: append rows below the standard set.

## Wiring

- Firebase Analytics both stacks; all logging through the single `AnalyticsService` façade (testable, findable).
- **RevenueCat → Firebase Analytics integration ON** so revenue events land beside product events.
- Crashlytics from day 0 (M0): set app/build version, log only sanitized operation names, record non-fatals for recoverable provider failures, and verify one deliberate **dev/TestFlight-only** test crash appears in the console before release. Never send prompts, image URLs that identify a person, tokens, request bodies, or raw provider responses.
- Firebase Performance Monitoring from M0: trace cold launch and the core action; add custom attributes only from a short approved allowlist (`feature`, `provider`, `result`)—never UID, prompt, email, or request ID.
- Verify every new event in Firebase **DebugView** before merging (post-change gate).

## KPI definitions

| KPI | Formula | Read where |
|---|---|---|
| Onboarding completion | `onboarding_complete` / `onboarding_start` | Firebase funnel |
| Paywall conversion | `trial_start` + direct `purchase` / `paywall_view` | Firebase + RC |
| Trial → paid | RC dashboard (source of truth) | RC |
| D1 / D7 retention | Firebase retention report | Firebase |
| MRR, churn, refund rate | RC dashboard | RC |
| Month-1 ARPU | RC month-1 revenue / month-1 downloads (target ≥ $2; `growth_diagnose` funnel stays counts-only by design) | RC + Firebase |
| Crash-free users | Crashlytics dashboard | Firebase |
| Core-action failure rate | `core_action_failed` / core action attempts | Firebase |

Targets live in PRODUCT.md; review weekly against RevenueCat benchmarks (`docs/playbooks/monetization.md`).
Post-launch funnel baselines and ranked experiments live in `docs/growth-plan.md`; run
`/growth-loop` to compare evidence windows without inventing missing metrics.

## Experiment ledger rule

One experiment = one hypothesis + one primary metric + minimum runtime, logged in `docs/decisions.md` with the result. No overlapping experiments on the same surface.

## Automation split

| Claude automates | Human does |
|---|---|
| Event wiring + façade, DebugView verification steps, funnel definitions, weekly KPI summary drafts | Interprets KPIs, picks experiment winners, sets targets |

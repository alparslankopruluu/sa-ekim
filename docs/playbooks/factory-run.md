# Factory Run

*Read this when: running `/factory-run`, resuming a factory run, or changing factory orchestration.*

Factory mode turns one reference app URL or product idea into a verified internal
TestFlight build. It is an opt-in superset of `/new-app`, `/store-assets`, and `/ship`;
those commands remain available independently.

## Non-negotiable contract

- Ask for **one blueprint approval** before the first external write. That approval
  covers the exact Firebase, Cloudflare, App Store Connect, RevenueCat, and internal
  TestFlight actions listed in the blueprint.
- App Store review submission, phased release, price changes outside the approved
  blueprint, billing attachment, destructive changes, and conflicts with existing
  remote resources always require a new approval.
- Never run with `--dangerously-skip-permissions`. Never put credentials, tokens,
  private keys, cookies, or raw secret-bearing output in prompts, state, evidence,
  logs, commits, or screenshots.
- Never delete projects, apps, buckets, builds, certificates, profiles, products,
  subscriptions, or DerivedData. Never run bare `firebase deploy`.
- All remote mutations follow **audit/dry-run -> approved apply -> readback**. If a
  tool lacks dry-run, list/read the target first and compare canonical identifiers.

## State and checkpoints

Use `scripts/factoryctl.py` before and after every task. Confirm its exact flags with
`python3 scripts/factoryctl.py --help`; the expected verbs are:

```bash
python3 scripts/factoryctl.py doctor
python3 scripts/factoryctl.py run init --source "$SOURCE" --locales launch
python3 scripts/factoryctl.py task start TASK_ID
python3 scripts/factoryctl.py context route --intent-stdin
python3 scripts/factoryctl.py context prepare TASK_ID
python3 scripts/factoryctl.py task submit TASK_ID --receipt path/to/receipt.json
python3 scripts/factoryctl.py receipt validate path/to/receipt.json
python3 scripts/factoryctl.py task accept TASK_ID
python3 scripts/factoryctl.py task reject TASK_ID --reason "Evidence or scope mismatch"
python3 scripts/factoryctl.py task wait TASK_ID --reason "Human action"
python3 scripts/factoryctl.py task fail TASK_ID --error "Redacted summary"
python3 scripts/factoryctl.py evidence add TASK_ID path/to/redacted-artifact
python3 scripts/factoryctl.py human resolve ACTION_ID --active-minutes 2.5
python3 scripts/factoryctl.py status
```

`.factory/run-state.json` is the resumable, secret-free source for the status UI.
Use immutable task IDs and dependencies. Do not mark a task successful without a
readback or local validation artifact. Keep large output in evidence files and only
a redacted summary in state; event history is capped by `factoryctl`.
Launch the read-only native window with `scripts/open-factory-status.command --background`. Human active minutes are entered only when resolving a card; provider/build waiting time is not counted.

For schema-v2 tasks, `task submit` moves verified worker output to `review_pending`; the
lead validates the receipt and explicitly accepts or rejects it. `needs_revision` is not
completion. `task done` is retained for legacy state only and cannot manufacture a v2
success without an accepted receipt/evidence chain. See `context-engineering.md` for
capsule freshness, receipts, checkpoint, and blueprint-approval digest rules.

Checkpoint after `research`, `blueprint`, `mobile`, `backend-web`,
`localization-assets`, and `release`. At each checkpoint:

1. Update the owning canonical docs immediately.
2. Record completed IDs, evidence paths, unresolved risks, and the next task.
3. Start a fresh agent context when practical; do not carry full logs forward.
4. Use at most three independent workers. The root agent owns the graph, integration,
   approvals, and every external write. If workers are unavailable, run the same graph
   sequentially.

Before delegating any task, read `docs/playbooks/remote-execution.md`. `cloud_safe`
means a bounded, branch-scoped research/document draft with no secrets, `.factory`
access, provider authentication, paid API, or external write. The local root reviews and
merges the diff, attaches evidence, and alone changes task state. `local` is the safe
default and is mandatory for Xcode, Simulator, Keychain, signing, provider/resource
operations, asset capture, release validation, and TestFlight.

### Canonical task graph

Immediately after `run init`, add these immutable tasks in order. On resume, never add
an existing ID again:

```bash
python3 scripts/factoryctl.py task add strategy.research "Research market, competitors, and evidence" --lane cloud_safe
python3 scripts/factoryctl.py task add strategy.score "Score opportunity and decide go/reposition/no-go" --lane cloud_safe --depends-on strategy.research
python3 scripts/factoryctl.py task add product.screen-map "Define core journey, screens, states, and acceptance" --lane cloud_safe --depends-on strategy.score
python3 scripts/factoryctl.py task add growth.launch-plan "Define distribution, funnel, and launch experiments" --lane cloud_safe --depends-on strategy.score
python3 scripts/factoryctl.py task add architecture.quality "Define architecture and engineering-quality boundaries" --lane cloud_safe --depends-on product.screen-map
python3 scripts/factoryctl.py task add security.threat-model "Classify data, threats, abuse, and review risks" --lane cloud_safe --depends-on product.screen-map
python3 scripts/factoryctl.py task add blueprint.prepare "Prepare original blueprint" --lane cloud_safe --depends-on product.screen-map --depends-on growth.launch-plan --depends-on architecture.quality --depends-on security.threat-model
python3 scripts/factoryctl.py task add blueprint.approve "Approve blueprint and writes" --lane local --depends-on blueprint.prepare
python3 scripts/factoryctl.py task add app.specialize "Specialize product and kit" --lane local --depends-on blueprint.approve
python3 scripts/factoryctl.py task add mobile.build "Build and test mobile app" --lane local --depends-on app.specialize
python3 scripts/factoryctl.py task add firebase.provision "Provision Firebase dev and prod" --lane local --depends-on blueprint.approve
python3 scripts/factoryctl.py task add web.scaffold "Build public web routes" --lane local --depends-on blueprint.approve
python3 scripts/factoryctl.py task add admin.secure "Build secure admin surface" --lane local --depends-on firebase.provision --depends-on web.scaffold
python3 scripts/factoryctl.py task add r2.provision "Provision R2 assets and Worker" --lane local --depends-on blueprint.approve
python3 scripts/factoryctl.py task add push.prepare "Prepare push infrastructure" --lane local --depends-on firebase.provision --depends-on mobile.build
python3 scripts/factoryctl.py task add asc.app "Resolve signing and ASC app" --lane local --depends-on blueprint.approve
python3 scripts/factoryctl.py task add asc.catalog "Configure ASC products and prices" --lane local --depends-on asc.app
python3 scripts/factoryctl.py task add revenuecat.sync "Reconcile RevenueCat catalog" --lane local --depends-on asc.catalog
python3 scripts/factoryctl.py task add localization.ui "Localize and validate UI" --lane local --depends-on mobile.build
python3 scripts/factoryctl.py task add mvp.acceptance "Accept M1/M2 release candidate and freeze the store story" --lane local --depends-on mobile.build --depends-on localization.ui --depends-on revenuecat.sync
python3 scripts/factoryctl.py task add localization.store "Localize store metadata" --lane local --depends-on asc.app --depends-on mvp.acceptance
python3 scripts/factoryctl.py task add assets.icon "Generate and validate final marketing icon" --lane local --depends-on mvp.acceptance
python3 scripts/factoryctl.py task add assets.screenshots "Capture and validate screenshots" --lane local --depends-on mvp.acceptance
python3 scripts/factoryctl.py task add release.validate "Run complete release gates" --lane local --depends-on admin.secure --depends-on r2.provision --depends-on push.prepare --depends-on revenuecat.sync --depends-on localization.store --depends-on assets.icon --depends-on assets.screenshots
python3 scripts/factoryctl.py task add testflight.internal "Upload and verify internal TestFlight" --lane local --depends-on release.validate
python3 scripts/factoryctl.py task add handoff.report "Write factory handoff" --lane local --depends-on testflight.internal
```

At a checkpoint, call `run phase research|blueprint|mobile|backend-web|localization-assets|release`.
For an approval/manual step, add the human card first, then pass its ID to
`task wait ... --human-action-id ...`. Resolve the card, restart the waiting task, and
read back the external state before marking it done.

## Phase 1 — preflight and resume

1. Read `PRODUCT.md`, `docs/mvp-plan.md`, `docs/product-map.md`, `docs/growth-plan.md`,
   `docs/security-model.md`, applicable stack/architecture docs, this playbook, and
   linked quality/release playbooks. For SwiftUI, also read
   `docs/playbooks/ios-expert-tools.md` before invoking an external skill/MCP.
2. Run `factoryctl doctor` (which includes `asc auth doctor`) and `/factory-setup` if
   required tools/auth are missing.
3. If `.factory/run-state.json` contains a nonterminal run, show its last checkpoint
   and call `python3 scripts/factoryctl.py run resume`. Do not initialize another run
   or recreate resources.
4. Initialize with the selected locale profile. `launch` is the default nine;
   `extended` is 22. `docs/locales.json` is the machine-readable authority.
5. Validate the non-secret operator profile. Missing secrets become Keychain/OAuth
   setup actions; they are never accepted in chat or written to the profile.

## Phase 2 — research and original blueprint

Read `docs/playbooks/product-strategy.md`. Inspect at least five direct competitors plus
relevant substitutes through public listings, reviews, websites, pricing, screenshots,
visible flows, public Reddit/X discussion when available, and public ad-transparency
libraries. Paid market-intelligence tools are not required or used by default. Produce a
sourced/dated artifact covering promise, core loop, review
themes, monetization, ASO position, acquisition channel, retention mechanism, and design
patterns. Mark each claim observed/sourced/assumption; never invent market or funnel data.

Do not copy source, name, icon, screenshots, trade dress, or store copy. Produce an
original wedge and check App Store name collision plus basic trademark risk. Run
`scripts/opportunity_score.py`; only `go` may continue. `reposition` or `no_go` stops
before blueprint/build, proposes a narrower ICP/wedge/channel/monetization, and waits
for approval to research and score the revision. Never lower a score to force progress.

Fill PRODUCT.md, `docs/product-map.md`, `docs/growth-plan.md`, and
`docs/security-model.md`. Apply `docs/checklists/engineering-quality.md` and native
motion-quality guidance to the proposed architecture. Run one compact CEO → Product Owner → Design → Tech Lead → Security/Review
→ Growth consistency pass; these are lenses over canonical docs, not separate reports.
Get an independent review pass (subagent, second session, or manual) over these
documents before presenting the approval view below.

The approval view must contain:

- product name, pitch, target user, core action, original wedge, design direction,
  motion personality/rare delight moments, evidence strength, eight opportunity
  scores/decision, and go/kill criteria;
- the gotcha moment in one sentence, which screen is the gotcha/billboard screen,
  the declared v1 screen count (a number — scope creep must be visible at approval),
  and the tarpit/clone screen result (pass, or the critical risk that blocked);
- three-second demo, honest video-ready core state, strongest first-two screenshot
  benefits, product-page narrative, supported store locales, CPP audience/intent+keyword/
  creative/iOS 18+ deep-link/analytics mapping, one-variable PPO metric/sample/duration/
  stop contract, In-App Event opportunity or N/A reason, preview-only header/search-result
  creative, and the first organic creative hook/stop condition;
- core journey/screen-state scope, engineering boundaries, category/threat flags,
  north star, acquisition thesis, six-week launch plan, post-launch social/website
  operating baseline, and first ranked experiment;
- stack, bundle ID, SKU, version/build, weekly/annual product IDs and prices;
- for Expo: official plugin/skills source, user-level MCP config and OAuth data flow,
  SDK 54+ project `expo-mcp` dependency/start script, authority matrix, and security-model
  note; SDK <54 is an upgrade/TODO blocker;
- locale profile and primary ASC locale;
- `{slug}-dev` / `{slug}-prod` Firebase projects and services;
- `{slug}-dev-assets` / `{slug}-prod-assets` R2 buckets and Worker routes;
- web routes `/`, `/support`, `/privacy`, `/terms`, `/admin`;
- RevenueCat project/app, `pro`, `default`, `onb_discount`, and package mapping;
- push value and whether the runtime permission prompt will be shown;
- every planned remote create/update and internal TestFlight tester/group;
- manual actions likely to remain: login/2FA, Blaze/billing, APNs, agreements.

Ask once: **Approve this blueprint and its listed external writes, including upload
to the named internal TestFlight group?** Record the approval with
`python3 scripts/factoryctl.py approval blueprint record --file <blueprint>`.
Before EVERY subsequent approval-gated external mutation, run
`python3 scripts/factoryctl.py approval blueprint audit --file <blueprint>` and stop on
`invalidated` — the digest check is the enforcement, not your memory: any changed
identifier, price, environment, entitlement, or unexpected remote conflict invalidates
the approval for the affected mutation and requires a fresh ask.

## Phase 3 — build and provision

Specialize the kit through `/new-app`, using approved answers without asking them
again. Factory mode deliberately overrides the classic optional-backend rule:

- render `templates/factory-infrastructure/template.json`: copy only its declared targets, replace `__APP_NAME__`, `__APP_SLUG__`, and `__SUPPORT_EMAIL__`, reject unknown/remaining tokens, then run every `postCopyChecks` command;
- provision Firebase dev/prod for every factory app: iOS/web registrations, Hosting,
  Auth, Firestore, Functions, Storage, Remote Config, Analytics, App Check, and FCM;
- scaffold Vite + React + TypeScript with the five required routes;
- provision R2 dev/prod and a read-only public asset Worker per
  `docs/playbooks/cloudflare-r2.md`;
- prepare push infrastructure for every app, but show the notification permission only
  when the approved blueprint names a concrete user benefit;
- treat Blaze linking, APNs/provider UI, production deploys, and any console-only step
  as a precise `waiting_human` card.

Admin access uses Google sign-in and a callable `requestAdminAccess` Function.
The Function reads `ADMIN_EMAILS` from server-side secret/config, enforces App Check,
and grants `admin=true` only to an allowlisted verified email. Every admin endpoint and
rule checks the claim plus App Check. The starter admin has health/config/release
surfaces only: no public user search, PII browser, or general user CRUD.

Run builds, lint/typecheck, tests, Firebase rules tests, engineering-quality, threat-model
parity, and security gates. Run motion review when relevant code changed. Never weaken a
gate to make automation green.

For SwiftUI, select at most the focused expert skill that matches the current surface:
SwiftUI, concurrency, testing, or blueprint-approved SwiftData. Missing optional skills
are not blockers. `xcodebuild`/`simctl` remain the baseline; connected XcodeBuildMCP may
drive local scheme/simulator discovery, build/launch, accessibility UI, screenshots, and
logs. Axiom requires explicit `--axiom-beta` setup and a narrow diagnostic question;
never launch its full health-check by default.

## Phase 4 — catalog, localization, and assets

Follow `docs/playbooks/app-store-connect.md` for ASC, RevenueCat, signing, metadata,
screenshots, and TestFlight. Use `asc` as the primary store tool; Fastlane is only the
SwiftUI screenshot fallback and EAS only produces the Expo IPA.

Translate UI and metadata for the selected profile. Validate key parity,
interpolation, plurals, RTL, field limits, and `docs/locales.json` mapping. Store
keywords are researched per locale rather than translated.

Generate three original icon concepts, choose the one matching the approved design,
and validate 1024x1024, color profile, alpha rules, and asset catalog. Capture real UI:

- SwiftUI: current `asc screenshots`/AXe + simctl pipeline; Fastlane Snapshot fallback.
- Expo: Maestro + simctl.
- Compose captions with the kit script; use current `asc`/Koubou framing only after
  checking `asc screenshots --help` because local screenshot commands may be experimental.
- Validate dimensions, no alpha, locale, device family, and feature truth before
  `asc screenshots plan/apply`.

## Phase 5 — release boundary

Build the IPA, run `asc validate`, `asc review doctor`, digital-goods checks, signing,
privacy, age-rating, export-compliance, metadata, and screenshot checks. Upload only
when all required gates are green.

`release.validate` owns sanitized proof for cross-UID IDOR, auth/cost abuse limits,
applicable upload validation, exact-origin credentialed CORS, deployed CSP/HSTS/
`frame-ancestors`/`nosniff`/Referrer-Policy headers, working-tree plus git-history secret
scan, dependency/privacy/permission drift, and safe error responses. A configuration
file without deployed/readback evidence is not sufficient.

After blueprint approval, `asc publish testflight ... --wait` and adding the configured
tester to the configured **internal** group are authorized. Verify build processing,
group membership, tester membership, and What to Test notes by readback.

Stop with a factory report containing opportunity score/decision/evidence strength,
product-map/quality/security status, growth launch thesis/first experiment, build/release
evidence, remaining human cards, active human minutes, and the exact next action. Never
call `asc review submit`,
`asc publish appstore --submit`, enable phased release, or mutate pricing without a
separate explicit final approval.

## Failure policy

- Auth/2FA/UI selector failure: capture a non-sensitive screenshot, create a human
  card with exact recovery, and resume after readback.
- Existing remote resource: compare identifiers/config; reuse only on an exact match.
  Otherwise block—never rename, replace, or delete automatically.
- Transient command failure: retry only documented safe reads. Mutation-specific retry
  policy lives in the provider playbook.
- Partial run: record evidence and resume from the first incomplete dependency; do not
  repeat successful creates.

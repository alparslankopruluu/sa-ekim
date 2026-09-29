---
description: Turn one reference or idea into an original app and internal TestFlight build
argument-hint: <App Store URL or product idea> [--locales=launch|extended] | --resume
---

Run the app factory for: **$ARGUMENTS**

Start with `python3 scripts/factoryctl.py context route --intent-stdin`. Read and obey
`docs/playbooks/context-engineering.md`, `docs/playbooks/factory-run.md`, and `docs/playbooks/product-strategy.md`
completely. Read `docs/playbooks/remote-execution.md` before delegating. Read their linked growth, engineering, ASC, R2, Firebase, localization,
security, accessibility, performance, release, store-listing, and rejection documents
before each phase.
`docs/locales.json` owns locale profiles and ASC mappings.
For SwiftUI runs, also read `docs/playbooks/ios-expert-tools.md` before selecting an
external expert skill or simulator/build tool.

## Invocation

- Accept one App Store URL or product idea. Default `--locales=launch`; only accept
  `launch` or `extended`.
- If `app-intake.md` exists, use its answered fields and reference URL; never re-ask them. Explicit command arguments override only the source/locale profile.
- `--resume` requires `.factory/run-state.json`; call
  `python3 scripts/factoryctl.py run resume` and resume the first incomplete dependency.
- If an unfinished run already exists, show its checkpoint and resume it. Never initialize
  another run or recreate successful resources.
- Run `python3 scripts/factoryctl.py doctor`. If not ready, execute `/factory-setup` or
  create human actions; do not hide missing prerequisites.
- After init/resume, run `scripts/open-factory-status.command --background` so the local read-only status window follows the run.
- On a new run, set `python3 scripts/factoryctl.py run stage discovery`. Move to
  `planning` before the blueprint, `build` before implementation, and `release` before
  asset/release gates. Resuming preserves the recorded lifecycle stage.

## Execution contract

1. Initialize/resume the canonical `factoryctl` graph from the playbook. Wrap every
   task with `task start` and one
   receipt submission followed by lead `receipt validate` and `task accept` for v2 work;
   attach redacted validation/readback evidence and run `status`.
   When resolving a human card, record measured active work with `human resolve ID --active-minutes N`; waiting time is not human work.
   Prepare/audit a context capsule at every checkpoint, agent change, compaction, and
   session close.
2. Research at least five direct competitors plus substitutes from the public-only
   evidence lane; evidence or label every business claim, and leave unverifiable
   downloads/revenue/ad-spend/organic-growth values `unknown/assumption`. Validate the
   one-sentence core job, honest three-second demo, and video-ready state. Run
   `python3 scripts/opportunity_score.py score ...`. Only `go` may
   continue;
   `reposition`/`no_go` waits for a revised wedge/ICP/channel and re-score.
3. Fill PRODUCT.md, `docs/product-map.md`, `docs/security-model.md`,
   `docs/growth-plan.md` (including first-two screenshot benefits, ethical creative
   hypotheses, and the post-launch social/website operating baseline), and apply engineering/motion-quality guidance; create an
   original product without copying protected expression.
4. Produce the complete blueprint required by `docs/playbooks/factory-run.md`. If running
   under Claude Code, spawn the `spec-consistency-reviewer` subagent for a fresh-context
   pass over the assembled blueprint inputs first, and fold its findings into what you
   show; then request **one approval** for its exact remote writes plus internal
   TestFlight upload.
5. Before approval, perform reads/local work only. Record the approval with
   `python3 scripts/factoryctl.py approval blueprint record --file <blueprint>`; before
   every later approval-gated external mutation run
   `python3 scripts/factoryctl.py approval blueprint audit --file <blueprint>` and stop
   on `invalidated`. After approval, use audit/dry-run -> apply -> readback and stop on
   any unapproved diff or remote conflict.
6. Specialize/build the app, provision Firebase dev/prod, Vite web/admin, R2 dev/prod,
   push infrastructure, ASC/RevenueCat catalog, selected locales, icon, real screenshots,
   metadata, signing, and the IPA according to the playbooks. Prepare product-page growth
   plans locally through `/app-store-growth`; do not start CPP/PPO/In-App-Event writes as
   part of internal TestFlight delivery.
7. Use `asc` as the store authority; require `factoryctl doctor`/`asc auth doctor` green
   for this run and confirm every command with installed `asc --help`.
   Route each ASC task through the exact audited skill mapping in
   `docs/playbooks/app-store-connect.md`; load no unrelated pack skill.
   Use visible local browser automation only for the missing app-create API; login/2FA
   stays human. Do not auto-retry the Create click.
8. Reconcile RevenueCat by `ASC productId == RevenueCat store_identifier` using
   audit -> approved apply -> readback. Follow the documented three-retry maximum for
   transient 409s; never blind-create or delete/recreate.
9. Validate engineering-quality, threat-model parity, category review, security,
   performance, accessibility, and release gates; upload with current
   `asc publish testflight ... --wait`, add the
   configured tester to the approved internal group, and verify build/group/tester state.
   For SwiftUI, use only the focused expert skill matching the changed surface. Prefer
   connected XcodeBuildMCP for local simulator/UI/log evidence after the full project
   exists; retain `xcodebuild`/`simctl` as the portable baseline. Missing optional skills
   or MCP never blocks a run whose canonical checks pass.
10. Stop before App Store review. `asc review submit`, `asc publish appstore --submit`,
   external TestFlight, phased release, and unapproved price changes need separate approval.
   Skill examples never override these boundaries or authorize cleanup/expiry/revocation.

Checkpoint after research, blueprint, mobile, backend/web, localization/assets, and
release. Keep handoffs concise; large logs remain in evidence. Use at most three ordinary
independent workers. If the user explicitly requests large fan-out and the task passes the
task-shape gate, route it through `/dynamic-workflow`; its validated plan, isolated writers,
agent limits, and receipt aggregation do not expand the blueprint. The root agent owns task
graph, integration, approval, and all external writes.

At every checkpoint, run `python3 scripts/factoryctl.py recommend refresh` and
`python3 scripts/factoryctl.py recommend list`. Append a compact `/factory-next` summary:
at most three recommendations with why/role/risk/delegation, up to ten TODOs, and pending
human approvals. A recommendation never expands the approved blueprint.

Only tasks marked `cloud_safe` may be remotely delegated. Remote workers receive no
secrets, `.factory` state, provider access, or external-write authority; they return a
branch/diff and concise handoff. All build, Xcode/Simulator, signing, provider, asset,
release, and TestFlight tasks remain `local`.

Never use `--dangerously-skip-permissions`, persist secrets, run destructive cleanup,
delete remote resources, or run bare `firebase deploy`.

Final output:

```text
FACTORY REPORT — <app> <version> (<build>)
Run/checkpoint: …
Blueprint digest: …
Opportunity: score/decision + evidence strength
Product/quality/security: product-map + engineering + threat/category gates
Growth launch plan: north star + channel + first experiment
App + web/backend: ✅/❌ with evidence
ASC + RevenueCat: ✅/❌ with readback
Locales + assets: ✅/❌
Release gates: ✅/❌
Internal TestFlight: ✅/❌ build/group/tester status
Human actions: …
Human active minutes: …
Review submission: NOT SUBMITTED
Next exact action: …
```

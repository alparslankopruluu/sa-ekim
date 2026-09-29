---
description: Recommend the next best factory actions, manage TODOs, and prepare a safe task prompt
argument-hint: [--all] [--run <capability-id>] [--todo <id> --placement=after-current|after-milestone|later] [--dismiss <id>] [--done <id> --task-id <task>]
---

Find the next useful app-factory action for: **$ARGUMENTS**

Run `python3 scripts/factoryctl.py context route --intent-stdin` first and use only its
state projection. Do not read the full catalog, capability-state, run-state, or installed
extras. Read `docs/playbooks/context-engineering.md` after selection and then only selected
context refs. Use factoryctl's compact non-JSON recommendation/status output for active
milestone, blockers, human actions, release/health, and Android parity. Never copy credentials or raw provider payloads
into prompts, recommendations, TODOs, or output.

If routing remains low-confidence, use its `external-skill-discovery` fallback and
`docs/playbooks/skill-discovery.md`. Use `/find-skills <goal>` to inspect at most three
candidates, but install nothing without exact source/skill/destination approval.

## Invocation

- With no arguments, run `python3 scripts/factoryctl.py recommend refresh`, then
  `python3 scripts/factoryctl.py recommend list`; show at most three `now` recommendations
  and ten active TODOs. On the local Mac, also open the safe status window with
  `scripts/open-factory-status.command --background` so the same state stays visible.
- When the user asks what the kit can do or wants the capability UI, open
  `scripts/open-factory-status.command --background --capabilities`; do not require a command.
- `--all` runs `python3 scripts/factoryctl.py capability list` and groups the catalog by
  lifecycle stage and role. Also show discovered local skills/MCPs as **Available extras**;
  extras without a trusted catalog mapping are informational and never auto-run.
- `--todo ID`, `--dismiss ID`, or `--done ID --task-id TASK_ID` performs exactly one corresponding
  `factoryctl recommend` transition, refreshes the list, and reports the resulting state.
  Reject conflicting actions, missing IDs, duplicate flags, and unknown arguments.
- Queue work for a safe insertion point with `factoryctl recommend todo ID
  --placement=after-current|after-milestone|later`; reorder it with `factoryctl recommend
  move ID --before|--after OTHER_ID`. Queueing never authorizes execution.
- `--run CAPABILITY_ID` does not execute the capability. Resolve it from the catalog and
  produce a credential-free task card containing scope, expected outcome, invocation,
  role lens, prerequisites, availability, risk, delegation policy, files/evidence to read,
  acceptance criteria, any exact human approval that a later external action needs, and
  `recommend done CAPABILITY_ID --task-id TASK_ID` after an accepted v2 receipt.
- Lifecycle stage is changed only through an explicit user request and
  `python3 scripts/factoryctl.py run stage <stage>`; recommendations never advance it.

## Recommendation contract

1. Treat `docs/capabilities.json` as the canonical catalog and factoryctl output as the
   canonical project state. Do not invent an unavailable command or silently repair a
   malformed catalog/state file.
2. Reliability, payment, security, provider, and release blockers outrank milestone work;
   then honor `after-current`, quality gates, `after-milestone`, stage improvements, and
   `later` work in that order. Optional improvements and growth never jump a safety gate.
3. Do not recommend promotional work while a red health/release blocker exists. In
   post-launch, health/readiness and draft work precede publish or recurring schedules.
4. Preserve completed and dismissed decisions within the same lifecycle stage. Explain
   why each recommendation is timely and what measurable improvement it targets.
5. A small review uses the named role as a root-agent lens. Delegate only independent,
   secret-free `cloud_safe` research/document work, with one output, explicit file/diff
   bounds, and acceptance criteria. Use at most the catalog's worker limit and never more
   than three ordinary workers. Only an explicit large-fan-out request may route to
   `dynamic-workflow`; its separate validated policy is 8 concurrent/20 total by default,
   with isolated writers and exact scope/spend approval above 20. Root owns synthesis,
   state, approvals, and external writes.
6. Never delegate Xcode/Simulator, signing, provider connection, release, deploy,
   publishing, spend, or any task needing credentials. A recommendation or prepared task
   is not authorization to mutate an external system.
7. After every factory checkpoint, refresh and append the compact summary below. Keep
   detailed logs and evidence in their canonical files.

The native window exposes Today, Queue, and Capabilities, including Context Health and
review-pending progress. `Continue in…` copies only a short redacted bootstrap and opens a
selected local agent; it never injects a prompt or invokes shell/network/provider work. It may only make locked atomic
0600 writes to `.factory/capability-state.json`; it never runs factoryctl, shell commands,
provider work, deploys, publishing, or spend. `/factory-next` opens it automatically.

For a prepared task, give both the Claude invocation and portable Agent Skill invocation.
If prerequisites or availability checks fail, prepare a TODO for the missing dependency
instead of pretending the task is ready.

Output:

```text
FACTORY NEXT — <app> · <lifecycle stage>
Recommended now (max 3):
1. <title> — <why now> · <expected improvement> · <role> · <risk>
   Run: <Claude invocation> | <portable skill invocation>
   Delegation: root lens | cloud_safe N
TODOs (max 10): …
Human approvals: …
Available extras: … | hidden unless --all
Prepared task: none | <capability ID, prompt/task-card path or copy-ready prompt>
```

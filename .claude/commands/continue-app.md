---
description: Audit, document, and safely continue an existing partially built app
argument-hint: [--mode=audit|plan|continue] [optional task or path]
---

Continue this existing app for: **$ARGUMENTS**

Default to `--mode=continue`. `audit` is read-only; `plan` may repair canonical memory
docs; `continue` may also implement the best verified in-scope TODO. Reject unknown flags.

## Protect the existing repository

Read the active agent instructions, `git status`, recent history, root manifests, source,
tests, CI, and existing docs. Treat dirty work as user-owned. Never scaffold over the app,
reset changes, delete custom files, or replace its architecture with the kit template.
Never overwrite existing work.
Confirm real root-level app/source markers exist; otherwise route a blank product to
`/new-app` or `/factory-run`.

Run safe baseline build/lint/typecheck/tests from the repository's own configuration.
Inspect optional factory state without treating it as canonical memory.

## Reconstruct truth and review

Merge work signals in this order: crash/security/payment/provider/build blockers; current
milestone; unchecked `docs/mvp-plan.md` items; explicit TODO/issue files and unfinished
tests; validated TODO/FIXME comments; recent/dirty in-progress work; documentation drift;
optional improvements.

Run a risk-ranked code review of changed and core-flow code with
`critical/high/medium/low` findings and exact
file/line evidence. Cover architecture, concurrency, recovery/error behavior, security and
privacy, purchases, analytics, accessibility, performance, tests, and duplicate code.
Load stack-specific reviewer skills only when relevant; they do not broaden scope.

## Repair memory, then continue

Update existing canonical files in place from observed evidence only: `PRODUCT.md`,
`docs/stack.md`, architecture, product map, shipped features, data/security/growth state,
MVP plan, backlog, and decisions. Preserve custom sections. Unknown stays unknown. Keep
one owner per fact and never create a separate adoption/status report.

For audit, return findings and ordered work only. For plan, repair memory and hand off the
next task. For continue, prefer an in-progress unblocked documented task; otherwise choose
blocker → current milestone → quality gate → stage improvement. State acceptance, files,
validation, and external approvals, then implement the smallest coherent local change.
Ask only when competing choices materially alter product scope.

Never provision, deploy, publish, spend, sign, submit, or modify protected files without
their existing approvals. Set lifecycle stage only after explicit user confirmation.
Update the owning memory and checkbox immediately after verified work. At checkpoints run
`python3 scripts/factoryctl.py recommend refresh`; after the adoption baseline and selected
task pass, run `python3 scripts/factoryctl.py recommend done continue-app`, then refresh.

Report baseline health, risk-ranked review findings, current milestone, repaired memory,
merged/rejected TODOs, completed work, validation, blockers, and the exact next action.

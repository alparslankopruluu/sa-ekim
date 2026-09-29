---
description: Diagnose and prepare verified Codex, Claude, or CLI handoffs
argument-hint: [--mode=diagnose|prepare|eval] [--target=codex|claude|cli]
---

Use `$ARGUMENTS`, defaulting to `--mode=diagnose` and the project's preferred agent.
Accept only `--mode=diagnose|prepare|eval` and `--target=codex|claude|cli`. Work only
with factory-owned local contracts; never claim access to hidden system prompts,
provider tool schemas, credentials, quota, process arguments, or opaque harness overhead.

## 1. Establish the contract

1. Read `docs/playbooks/context-engineering.md` and inspect the active task, run context,
   HEAD, working-tree digest, capsule sequence, and approval boundary.
2. For `diagnose`, run `harness inspect TASK_ID`, then validate the named capsule or
   receipt with `harness validate PATH --kind=capsule|receipt`. Report exact error code and
   JSON pointer; do not silently discard unknown fields. Treat a missing desktop/CLI target
   as degraded, not as proof that the underlying model is unavailable; never install or
   authenticate a harness without separate approval.

## 2. Prepare or regenerate

- For a fresh handoff, run:

  ```bash
  python3 scripts/factoryctl.py harness render TASK_ID --target=TARGET
  ```

  Pass the short redacted bootstrap, not the whole capsule — remote/copy-only workers get
  the same bootstrap. The receiving agent must audit freshness before reading JIT context
  refs.
- If a local contract is invalid or stale, there is no automatic repair loop: regenerate it
  with a fresh `harness render`, preserving task meaning, scope, evidence, and authority.
- Never retry provider/deploy/publish, protected-file, approval-changing, stale, or
  unreadable contracts. Prepare a fresh capsule and obtain renewed approval when the
  mutation scope changed.
- Strict schema conformance proves format, not factual success. A worker still submits a v2
  receipt and the lead accepts or rejects its evidence.

## 3. Evaluate parity

For `eval`, render the same task for Codex, Claude, and CLI and compare their
`canonicalTask` and `packetDigest`. Target-specific bootstrap hints may differ; objective,
allowed/forbidden paths, acceptance, evidence boundary, next action, and approval boundary
must be identical. Stop on any semantic drift.

Report target, adapter/schema versions, Compatible/Degraded/Blocked status, packet/source
digests, validation errors, measurable byte/token fields, opaque overhead as
unknown, and the exact safe next action. Do not add persona inflation, visible
chain-of-thought requests, or generic “do not make mistakes” prose.

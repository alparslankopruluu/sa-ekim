# Context Engineering and Continuation

*Read after `factoryctl context route` selects a nontrivial capability, before a
checkpoint/handoff, and before resuming any v2 task.*

## Purpose and boundary

Correct, current, task-bounded context is more useful than a long prompt, but it is not a
guarantee against errors. This kit keeps canonical memory docs and JIT skills; it adds a
deterministic router, verifiable continuation package, and lead-reviewed completion receipt.
It does **not** add embeddings, vector search, a vector database, or a RAG service, by design.
Prompt caching may lower cost/latency where a harness supports it; it is not memory, quality,
or continuation proof.

## Deterministic route and JIT loading

Send natural-language intent through:

```bash
python3 scripts/factoryctl.py context route --intent-stdin
```

The route combines lexical/BM25-like intent match with stack, lifecycle stage, health, and
availability. It returns only the relevant state projection, selected capability, context
references, execution/tool requirements, and metrics. A high-confidence smallest suitable
capability is selected automatically. At low confidence, the lead makes a semantic decision
between the three compact candidates; do not ask the user to name a skill.

Only after selection load the named skill, playbook, and tool/MCP surface. Do not preload the
complete catalog or hundreds of installed extras. A harness may inject system instructions or
tool schemas that this kit cannot inspect; report their input/cached/output tokens only when
the harness supplies them and call the remainder **opaque harness overhead**. Never estimate it
as certain or claim it was removed.

Use a lean task frame: goal, relevant context, constraints, evidence, and success criteria.
Increase reasoning effort only after evidence that the task needs it.

## Capsules and freshness

Create or refresh a v2 task capsule before a worker starts and at milestones, agent changes,
compaction, or session close:

```bash
python3 scripts/factoryctl.py harness render TASK_ID --target=codex
# Use the capsuleId returned above, for example TASK_ID-1:
python3 scripts/factoryctl.py context audit CAPSULE_ID
```

The secret-free `.factory/context/<task-id>.json` capsule is atomically written with mode
`0600`, ignored by git, and normally keeps metadata under a 1,500-token soft limit. It binds:

- project root, branch, HEAD, and working-tree digest; task/run/capability IDs;
- objective, allowed/forbidden paths, exact next action, acceptance/validation commands;
- risks, approval limits, human actions, decisions, assumptions, and open risks;
- canonical references as path + heading + hash.

Document slices are opened JIT, not embedded. A changed HEAD/working tree, missing heading,
or reference hash mismatch is stale: stop continuation and refresh the capsule. Clipboard
handoff is a roughly 400-token bootstrap (root, task/capsule ID, freshness check, next action),
not the full capsule. Sequence number and source digest prevent reuse of stale clipboard text.

## Harness contracts

Factory-owned `ContextCapsule v2` and `CompletionReceipt v2` use closed Draft 2020-12
schemas under `docs/contracts/`. Unknown fields, wrong types/enums, missing fields,
malformed JSON, refusals/truncation, stale source, and packet-digest mismatch are distinct
machine-readable errors with JSON pointers. The validator uses only the standard-library
schema subset used by these contracts.

```bash
python3 scripts/factoryctl.py harness validate PATH --kind=capsule|receipt
python3 scripts/factoryctl.py harness inspect TASK_ID
```

Codex, Claude, and CLI adapters render the same canonical task and packet digest; only the
short target hint differs. There is no automatic repair loop: regenerate a malformed or
stale contract with a fresh `harness render`, and never retry a mutation, protected-file, or
unreadable contract. The kit never calls a provider to fix a packet.

An explicitly requested large fan-out additionally uses the closed WorkflowPlan v1 schema
at `docs/contracts/workflow.schema.json`. Validate it with `harness validate --kind=workflow`.
The plan controls task partitioning and agent budgets; it does not grant provider, secret,
protected-file, external-write, spend, or completion authority. Dynamic results are folded
into the optional `workflow` block of the normal CompletionReceipt v2 and still require lead
acceptance. Read `dynamic-workflows.md` before creating or running such a plan.

## Receipts, acceptance, and approvals

Workers produce a v2 completion receipt bound to the capsule and packet digest, containing result summary, changed paths, acceptance
results, validations, evidence references, source revision, decisions, assumptions, open
risks, and next action. It is a review candidate, not a success claim:

```bash
python3 scripts/factoryctl.py task submit TASK_ID --receipt RECEIPT.json
python3 scripts/factoryctl.py receipt validate RECEIPT.json
python3 scripts/factoryctl.py task accept TASK_ID
# or
python3 scripts/factoryctl.py task reject TASK_ID --reason "..."
```

Factoryctl verifies each referenced evidence ID and stores its current hash, byte size, and
source revision in the private receipt. It also rejects changed paths outside the task's
allowed paths or inside forbidden paths. Submitted work is `review_pending`; rejection becomes
`needs_revision`. Only a lead-accepted receipt may complete a v2 task or power
`recommend done CAPABILITY_ID --task-id TASK_ID`. v1 run states, receipts, and capsules are
unsupported by kit 4: re-init the run and prepare fresh v2 contracts; they cannot
prove new completion. Do not invent retrospective evidence. Blueprint approval is a separate
digest/receipt. Any identifier, price, environment, or mutation-scope change invalidates the
affected external-write authority and requires renewed approval.

## Cross-agent and remote handoff

Store the chosen local agent per project; do not inspect provider quotas, credentials, or
process arguments. Codex and Claude may be offered through safe bundle identifiers. For
Grok/CLI/Other, copy only the redacted bootstrap. Status may open an installed local app, but
must never inject a prompt or run terminal/subprocess/network/provider/deploy/publish work.

Remote workers receive only the short redacted bootstrap: no `.factory`,
absolute user path, private canonical context, secret, provider access, or external-write
authority. Shared Python/Swift redaction rules and corpus govern every handoff. The local lead
reviews the diff, receipt, evidence, validations, and scope before acceptance.

## Execution classes and inspector

Choose worker capability by task shape — this is model-choice guidance, not a machine-enforced
field:

- `frontier_high`: diagnosis, architecture, security, scope, synthesis, final review.
- `bounded_implementation`: scoped code with explicit boundaries and acceptance.
- `mechanical`: fixtures, contract tests, scans, and mechanical documentation.

Context inspector reports serialized capsule bytes, duplicate/conflicting references,
adapter/schema versions, packet/source digests, and handoff counts. Factory Status shows
context and harness health; accepted progress and `review_pending` remain separate.

Only accepted decisions/results are written to canonical owner docs. Raw chat and tool logs
stay out of the memory bank.

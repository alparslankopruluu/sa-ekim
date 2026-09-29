---
description: Run a bounded provider-adaptive multi-agent workflow with isolated writes, verification, and lead synthesis
argument-hint: <goal> [--provider=auto|claude|codex|grok|cli] [--mode=plan|run] [--concurrency=N] [--total=N]
---

Run a dynamic workflow for: **$ARGUMENTS**

Read `docs/playbooks/dynamic-workflows.md`, `docs/playbooks/context-engineering.md`, and
`docs/playbooks/remote-execution.md` completely. Route the intent first with
`python3 scripts/factoryctl.py context route --intent-stdin`. Dynamic workflows are an
explicit acceleration lane, not a replacement for the normal three-worker contract.

## Invocation

- Require a concrete goal. Accept only `auto`, `claude`, `codex`, `grok`, or `cli` as the
  provider and `plan` or `run` as the mode; default to `auto` and `plan`.
- Default limits are eight concurrently active agents and twenty total agent invocations.
  Use a lower provider/runtime limit when discovered. More than twenty requires the user's
  exact approved total, task scope, and spend ceiling before any agent is spawned.
- `plan` creates a secret-free WorkflowPlan v1 candidate and validates it with
  `python3 scripts/factoryctl.py harness validate PLAN --kind=workflow`; it performs no
  provider call, external write, paid action, or tracked-file edit.
- `run` requires the user to have explicitly requested execution. Revalidate the plan,
  current HEAD/working tree, adapter availability, limits, isolation, and approval bounds
  immediately before spawning.

## Execution contract

1. Use a workflow only when work divides into independent items, independent hypotheses,
   or rubric-based attempts. Use the normal root loop for serial semantic decisions, one
   small output, shared mutable resources, protected files, or latency/cost-sensitive work.
2. Select the smallest pattern: classify-and-act, fan-out-and-synthesize, adversarial
   verification, generate-and-filter, tournament, or loop-until-done. Record explicit stop
   conditions; never use an open-ended "until good" loop.
3. Produce WorkflowPlan v1 with objective, source revision/digest, adapter, model class,
   worktree policy, limits, spend ceiling, tasks/dependencies, validators, stop conditions,
   expected output, and approval requirements. Never put credentials or private provider
   payloads in the plan.
4. Every worker receives one bounded outcome, minimum context, allowed/forbidden paths,
   acceptance criteria, validation commands, and a structured response contract. Agents
   reading untrusted public content have no write, secret, provider, or external authority.
5. Shared tracked files have a single writer. Any parallel writing worker uses its own git
   worktree and branch. Root reviews and integrates commits one at a time; workers never
   merge, accept their own receipt, update factory state, or push.
6. Claude uses native Dynamic Workflows when present. Codex uses its native multi-agent
   tools/Responses API surface when present. Grok uses native bounded subagents/worktrees
   when capability-detected; otherwise use batches of at most three through the portable
   CLI contract. Never claim the ChatGPT chat UI itself is a programmable fan-out runtime.
7. Root owns task graph, approvals, spend, protected files, secrets, synthesis, conflict
   resolution, external writes, and completion. Provider/model failure may be retried once
   only for a read-only or isolated idempotent task; mutation retries require fresh review.
8. Aggregate worker result digests, validation evidence, rejected/duplicate findings,
   actual agent count, adapter, and final synthesis into the task's CompletionReceipt v2
   `workflow` block. A workflow run is not success until lead acceptance.

Output:

```text
DYNAMIC WORKFLOW — <goal>
Pattern / adapter: …
Plan digest + source revision: …
Limits: <concurrent>/<total> · spend ceiling: …
Isolation / authority: …
Tasks and validators: …
Run evidence / rejected findings: …
Lead synthesis and receipt: …
Human approvals / remaining risks: …
```

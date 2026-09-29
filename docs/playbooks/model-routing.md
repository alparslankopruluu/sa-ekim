# Orchestration, Model Routing, and Cost Discipline

*Read when: distributing work across a main agent and its subagents, choosing a model tier for a
task, deciding whether to parallelize, or setting up provider-specific agent profiles. This is the
always-on delegation policy; `docs/playbooks/dynamic-workflows.md` owns the large-fan-out contract.*

The kit is harness-agnostic and model-agnostic. Routing depends on the **task shape**, not
the model name the operator happens to run. The operator should never have to pick a model;
the agent picks a tier from the task and delegates bounded work downward.

## The one rule

**The strongest model thinks and verifies; cheaper models execute bounded work.** Paying a
frontier model for mechanical edits or fixtures wastes money and context. Paying a cheap
model for architecture, security, or synthesis risks a wrong, unverifiable result.

This mirrors the cost-efficient orchestration pattern: a planner/orchestrator (frontier)
decomposes, delegates, integrates, and approves; fast, inexpensive workers (for example a
high-throughput Flash-class model) do the bounded coding, debugging, research, and writing.
The kit does not pin a vendor; any harness with subagents, multi-agent tools, or headless
workers can apply the same split.

## Orchestrator mandate

When the harness exposes subagents (or any multi-agent tool), you are the orchestrator and the
work is distributed, not serialized:

- **You own:** architecture, planning, scope decisions, task decomposition and dispatch,
  integration, and final review/acceptance. These never leave the orchestrator.
- **Workers own:** bounded implementation, focused research, debugging with a clear repro, and
  mechanical edits — each with an explicit allowed-path scope, acceptance, and validation.
- **Use the workers.** If work decomposes into independent bounded items, dispatch them instead
  of doing them one after another yourself. Reserve serial work for genuine dependencies.
- **Workers never accept their own work.** Every result is a review candidate: check the diff,
  evidence, validations, and scope, then accept or send it back.
- **Effort sizes the fan-out**, not ambition — see the dispatch table below.
- **Capability-detect per harness.** If subagents or multi-agent tools are unavailable, run
  sequential bounded batches with the same gates rather than pretending parallelism.

The user should not have to say "use your subagents." Doing bounded work serially when it is
delegable, or accepting a worker's summary as proof, is a policy violation.

## Effort-based dispatch

Pick the smallest row that fits; never inflate it.

| Effort | Shape | Workers | Tier | Review |
|---|---|---|---|---|
| `trivial` | one file, no ambiguity | 0 (orchestrator) | orchestrator | server/self-check |
| `small` | one bounded change with known acceptance | 1 | bounded_implementation or mechanical | orchestrator accepts the receipt |
| `medium` | 2–3 independent bounded items | up to 3, in parallel | bounded_implementation / mechanical | orchestrator per receipt |
| `large` | 5+ independent items, or adversarial verification | dynamic workflow (default 8 concurrent / 20 total) | mixed | orchestrator synthesis + acceptance |

`medium` and `large` require independent items; a serial dependency chain is not parallel work.
Only an explicit large-fan-out request opens the `large` row; read
`docs/playbooks/dynamic-workflows.md` first and get approval above 20 total agent invocations.

## Model families (detect, do not hardcode)

Names below illustrate classes. Capability-detect what the current harness actually exposes and
never assume a model that is not available.

| Role | Representative class |
|---|---|
| Orchestrator — architecture, scope, synthesis, final review | a frontier model: Claude Opus/Sonnet class, GPT "Astra"-class, Gemini Pro, or Grok |
| Bounded implementation | the orchestrator, or a mid tier when delegation is cheaper |
| Mechanical / high-volume | the cheapest capable fast class, e.g. DeepSeek Flash, Haiku/Flash/mini class |

Any of DeepSeek, Grok, Codex/OpenAI, or Claude can play the orchestrator role; the split is by
task shape and effort, not by vendor. Match the worker's tier to the row in the dispatch table.

## Tiers

| Tier | Model class | Owns | Never delegates away |
|---|---|---|---|
| `frontier_high` | Strongest available | Diagnosis, architecture, security, scope, synthesis, final review, approvals | Protected files, acceptance, external writes |
| `bounded_implementation` | Mid/cheap high-throughput | Scoped code, tests for owned modules, refactors with explicit boundaries | Its own acceptance |
| `mechanical` | Cheapest capable | Fixtures, contract/scan scripts, mechanical doc updates, bulk renames | Anything ambiguous or cross-cutting |

These are the same execution classes defined in `docs/playbooks/context-engineering.md`.
That document owns the capsule/receipt mechanics; this document owns *who does the work*.

## Task-shape gate (decide before delegating)

Delegate only when **all** hold:

1. the work is bounded and has an explicit allowed-path scope;
2. acceptance and validation commands are known before the worker starts;
3. the work is secret-free (`cloud_safe`) or stays on the local machine;
4. a lead can review the diff, evidence, and receipt without re-doing the task.

Do **not** delegate: protected files, secrets, provider connection, release, deploy, publish,
spend, acceptance, or serial semantic decisions. Those stay with the orchestrator.

## Provider mapping

| Harness | Orchestrator | Worker |
|---|---|---|
| Claude Code | main session, native Dynamic Workflows when justified | subagents; assign a cheaper model to `mechanical`/`bounded_implementation` work |
| Codex / OpenAI | main agent (Astra-class), native collaboration tools | parallel subagents / Responses multi-agent beta, default concurrency three |
| Grok / CLI / other | single agent; bounded batches | if no native subagents exist, run sequential bounded batches and keep the same gates |

Capability detection is required: function calling or parallel tool calls alone do **not**
prove native dynamic orchestration. If a harness cannot isolate writers or verify
independently, fall back to bounded batches — do not fake a thousand-agent run. Large,
explicit fan-out is governed by `docs/playbooks/dynamic-workflows.md` (8 concurrent / 20
total by default, worktree-isolated writers, lead-owned synthesis).

## Cost discipline

- **Right-size the tier.** A one-line doc fix is `mechanical`; a paywall rewrite is
  `bounded_implementation`; a security review is `frontier_high`.
- **Batch independent bounded work.** Many small tasks with one rubric are cheap to fan out;
  a serial dependency chain is not.
- **Don't re-derive context per worker.** Hand a worker a capsule, not the whole repo. See
  `docs/playbooks/context-engineering.md`.
- **Never let a worker claim success.** Worker output is a review candidate; only an
  accepted receipt completes a task.
- **Report measured cost only.** Use the harness's own token/cost reporting; treat unknown
  harness overhead as opaque and never estimate it as certain.

## Anti-patterns

- Frontier model writing fixtures or reformatting docs.
- Cheap model making architecture/security calls or approving its own output.
- Delegating protected, secret, or external-write work.
- Spawning workers with no scope, no acceptance, or overlapping write paths.
- Inventing a model name the current harness does not actually expose; detect capabilities
  first and degrade gracefully.

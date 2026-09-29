# Dynamic Workflows

*Read when the user explicitly asks for a workflow, large fan-out, many independent checks,
adversarial verification, a tournament, or a large migration.*

Dynamic workflows let a root agent keep orchestration state in a bounded task graph while
independent agents work in clean contexts. They are valuable for complex, high-value work
that separates cleanly; they usually cost more tokens and are not the default for ordinary
coding. The app-factory normal lane remains at most three independent workers.

## Pinned doctrine and provider reality

The cookbook patterns were reviewed at
`anthropics/claude-cookbooks@f65eb122a51e9710d4db3f4893016879c65c77d6` and are referenced,
not vendored. Anthropic's current Dynamic Workflows guidance describes JavaScript-authored
fan-out, worktree isolation, model choice, resumability, synthesis barriers, adversarial
verification, tournaments, and explicit stop conditions:
https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code

- **Claude Code:** prefer native Dynamic Workflows when available; the generated script is
  transient provider state, while its validated plan digest and evidence stay factory-owned.
- **Codex/OpenAI:** prefer native collaboration tools. Programmatic integrations may use the
  Responses API multi-agent beta; its recommended default concurrency is three:
  https://developers.openai.com/api/docs/guides/responses-multi-agent
- **Grok:** capability-detect subagents, headless execution, and worktrees. Function calling
  or parallel tool calls alone do not prove native dynamic orchestration; use bounded batches
  when no native workflow runtime is exposed.
- **ChatGPT:** describe portability through Codex or the OpenAI API. Never advertise the
  consumer chat surface as an app-factory-controlled thousand-agent runtime.

## Task-shape gate

Use a dynamic workflow only when at least one is true:

- five or more independent items need the same rubric;
- two or more independent hypotheses should be tested against disjoint evidence;
- multiple attempts benefit from an impartial judge or tournament;
- a migration can be partitioned into non-overlapping modules/worktrees;
- every factual claim or rule needs independent verification.

Do not use it for a single small output, a serial dependency chain, a shared mutable file,
protected/provider work, or a task where a deterministic script can do the same work.

## Patterns

| Pattern | Use | Required barrier |
|---|---|---|
| Classify-and-act | Route heterogeneous items to bounded handlers | Validate every classification before action |
| Fan-out-and-synthesize | Independent research, modules, or checklist items | Wait for all required items; dedupe and reconcile |
| Adversarial verification | Security, factual claims, rules, migrations | A verifier did not produce the candidate it checks |
| Generate-and-filter | Names, concepts, approaches | Rubric, dedupe, rejection reasons, final shortlist |
| Tournament | Comparative judgment is more reliable than absolute scoring | Deterministic bracket and independent judge |
| Loop-until-done | Unknown count of failures/findings | Numeric ceiling plus no-new-findings or tests-green stop |

## WorkflowPlan v1

Create `.factory/workflows/<workflow-id>.json` with mode `0600`; `.factory/` is ignored.
Validate with `factoryctl harness validate PATH --kind=workflow`. The plan binds:

- `workflowId`, objective, source revision and working-tree digest;
- provider adapter and model class;
- `worktreePolicy`, concurrent/total agent limits, and optional spend ceiling;
- independent tasks with dependencies, allowed/forbidden paths, acceptance, and validations;
- stop conditions, validators, expected output, and approval requirements.

Defaults are eight concurrent and twenty total agent invocations, further reduced by the
runtime. Above twenty, stop and obtain approval for the exact total, scope, and spend ceiling.
No kit guarantee is made for a thousand-agent run.

## Isolation, authority, and receipts

Only one worker may write a tracked path. Parallel writers use isolated worktrees and return
commits; root reviews and integrates sequentially. Public/untrusted-content readers are
read-only. Secrets, protected files, provider mutations, purchases, deploys, publishing,
spend, acceptance, and factory state stay with root.

Workers return structured results and evidence, not success claims. Root records plan digest,
adapter, actual agent count, result digests, validators, rejected/duplicate findings, and
synthesis in the optional `workflow` block of CompletionReceipt v2, then follows the normal
lead acceptance flow.

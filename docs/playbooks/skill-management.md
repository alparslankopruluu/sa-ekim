# Skill Management

*Read when: adding, auditing, updating, or retiring a skill, or when the agent must find
and use the right skill without the user naming it.*

Skills are the kit's bounded, on-demand capabilities. Managing them well means: one
canonical home per skill, a thin portable adapter, a machine-checkable inventory, and a
lifecycle that includes retirement — so skills are neither lost nor silently duplicated.

## Two kinds of skill

| Kind | Location | Nature |
|---|---|---|
| First-party workflow | `.claude/commands/<id>.md` (canonical) + `.agents/skills/source-command-<id>/` (adapters) | Owned by the kit; one command + one portable adapter + one `agents/openai.yaml` |
| External | installed per the gate in `docs/playbooks/skill-discovery.md` | Third-party; recorded source/revision/license, never auto-run |

First-party skills are **thin adapters**: the full procedure lives in `.claude/commands/`,
and the `SKILL.md` only points to it. `tests/test_doc_consistency.py` fails if an adapter
grows a duplicate body, so a command can never drift from its portable form.

## Inventory and health

```bash
python3 scripts/factoryctl.py skills list       # every command, its adapter, external sources
python3 scripts/factoryctl.py skills health     # structural issues and orphan directories
```

`skills health` fails when a command has no `SKILL.md`, a first-party adapter has no
`agents/openai.yaml`, or a skill directory has no matching command (an orphan). Fix the
structure rather than deleting the check.

## Adding a first-party skill

1. Add `.claude/commands/<id>.md` (the canonical procedure).
2. Add `.agents/skills/source-command-<id>/SKILL.md` (frontmatter `name:` must equal the
   directory) that defers to `.claude/commands/<id>.md`, plus `agents/openai.yaml`.
3. Add the capability to `docs/capabilities.json` with `claudeInvocation: "/<id>"` and
   `skillInvocation: "$source-command-<id>"`. Tests require this coverage.
4. Route to it from `AGENTS.md` only if it is a top-level entry; otherwise let
   `factoryctl context route` surface it.
5. If the skill introduces new knowledge, add the playbook and regenerate the knowledge
   index (below).

## Using skills without preloading them

Never load every skill into context. Run `factoryctl context route --intent-stdin` first;
load only the selected skill/playbook. This is why adapters are thin and heavy content
lives in `docs/playbooks/`.

## Discovery and the knowledge index

`docs/knowledge-index.json` is generated from the docs tree. Any doc added under
`docs/` is automatically indexed (title, "read when" summary, routing triggers), so a new
playbook cannot be silently forgotten:

```bash
python3 scripts/factoryctl.py knowledge index    # regenerate after adding/removing docs
python3 scripts/factoryctl.py knowledge search --query "how do I rank in search"
```

The router confirms coverage; tests fail if the committed index drifts from the docs tree.

## External skills

Follow `docs/playbooks/skill-discovery.md`: local-first, at most three inspected candidates,
and installation only after approval for the exact source/skill/destination/target. After
install, record the source, revision, and license (the `find-skills` source is recorded in
`.agents/skills/find-skills/SOURCE.json`) and re-run `skills list`; external skills appear
as extras until an explicit catalog mapping is trusted.

## Retiring a skill

Remove the command, the adapter directory, and the catalog entry together, then run
`skills health` and the test suite. Leaving an adapter without a command (or the reverse) is
the orphan case the health check exists to catch, and the doc-consistency tests will block
it.

# External Skill Discovery

*Read only when the local context router has low confidence, the user explicitly asks for
an installable skill, or Factory Status prepares an external-skill search.*

## Local-first rule

Run `python3 scripts/factoryctl.py context route --intent-stdin` before searching outside
the kit. If one local capability is a high-confidence fit, use it and do not add another
skill. External discovery is a fallback for a real missing capability, not a way to grow the
catalog or agent context indiscriminately.

The kit vendors Vercel's official `find-skills` instructions at a recorded source revision.
Use them to search the open skills ecosystem with a specific, credential-free query:

```bash
npx skills find "<domain> <specific task>"
```

This is a network read. Factory Status never runs it; the selected local agent runs it after
showing the prepared query. Do not put product secrets, private paths, customer data, tokens,
or unpublished strategy in the query.

## Recommendation gate

Return no more than three candidates. For each candidate verify and show:

- exact skill name, source repository, maintainer, purpose, and skills.sh/GitHub link;
- install count and repository reputation as signals, never proof of safety;
- current revision or release, license, and recent maintenance;
- requested tools plus shell, network, credential, external-write, and protected-file scope;
- whether an existing kit capability already covers the same outcome.

Inspect the candidate `SKILL.md` and any referenced scripts before recommending it. Search
popularity alone is insufficient, and skill instructions never expand factory approvals.

## Install gate

Installation is a local write and requires approval for the exact source, skill, destination,
and target agent. Prefer project-local installation. Never add `-g`, overwrite an existing
skill, install every search result, or execute a newly installed skill automatically.

After approval, use the current CLI form shown by the source, for example:

```bash
npx skills add <owner/repository> --skill <skill-name>
```

Then verify the installed `SKILL.md`, record its source/revision/hash, refresh capability
discovery, and present the skill as an installed extra until it receives an explicit trusted
catalog mapping. Installation does not authorize provider, deploy, publish, spend, deletion,
or protected-file work.

If no credible skill exists, continue with the lead model's bounded general capability. If
the same gap recurs, propose creating a small first-party skill rather than repeatedly
searching or accumulating MCP/tool overhead.

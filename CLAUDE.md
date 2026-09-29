@AGENTS.md

# Claude bootstrap

Use the shared router above as the canonical instruction source. Before the first code
change, follow its verification step and state `Instructions verified.`

Claude Code may use its native `@AGENTS.md` import; this prevents instruction drift but does
not eliminate context cost. Start with `factoryctl context route --intent-stdin`, load only
the selected skill/playbook/tool surface JIT, and write/check capsules through factoryctl.
Do not paste a full capsule into chat or inspect provider credentials, quota, process args,
or hidden harness/system context.

For a low-confidence route, choose only among factoryctl's three short candidates. Claude
subagents follow the shared redacted-bootstrap, receipt, and lead-acceptance
rules. Claude-specific tools never expand blueprint, protected-file, provider, deploy,
publish, spend, or review-submission authority.

For a weak local route use `/find-skills <goal>`; inspect candidates and request exact install
approval. For “what can this kit do?” or “open Factory Status,” open the native status window
with `scripts/open-factory-status.command --background --capabilities` without asking the
user to remember a slash command.

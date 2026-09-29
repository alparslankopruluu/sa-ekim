---
description: Find a trusted external agent skill only when the local app-factory catalog has no strong fit
argument-hint: <goal>
---

Find a skill for: **$ARGUMENTS**

Read `docs/playbooks/skill-discovery.md`. Route the goal locally first with
`python3 scripts/factoryctl.py context route --intent-stdin`. If a high-confidence local
capability exists, use it and stop. Otherwise use the installed `find-skills` skill to run a
credential-free `npx skills find` query.

Return at most three verified candidates with source, purpose, install/reputation signals,
license, maintenance, requested tools, and security scope. Inspect `SKILL.md` and referenced
scripts before recommending anything. Do not install until the user approves the exact skill,
source, destination, and target agent. Prefer project-local installation; never auto-run a
new skill or let it expand provider, deploy, publish, spend, deletion, or protected-file
authority.

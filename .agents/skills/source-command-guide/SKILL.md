---
name: source-command-guide
description: Interview the user on product direction and route to the smallest useful app-factory capability and knowledge doc without requiring a command or skill name. Use when the user only has an idea, asks what the kit can do, or is unsure what to do next.
---

# Guide

Interview the user on product direction, then route to the smallest useful next step.

Read `.claude/commands/guide.md` in this repository and follow it verbatim; it is the
canonical procedure for this workflow. Run
`python3 scripts/factoryctl.py session start` and
`python3 scripts/factoryctl.py context route --intent-stdin`, then
`python3 scripts/factoryctl.py knowledge search --query "<question>"` and load only the
selected refs. Never ask the user to choose a skill.

Portable invocation: `$source-command-guide`.

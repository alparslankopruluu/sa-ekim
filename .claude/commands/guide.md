---
description: Interview the user on product direction and route to the smallest useful next step without requiring a command or skill name
argument-hint: [optional idea or question]
---

Guide the work for: **$ARGUMENTS**

This is the no-command entrypoint. The user may only have an idea, may ask what the kit
can do, or may be unsure what comes next. The conversation becomes the routing input; the
user is never asked to choose a skill or command.

1. If a project exists, run `python3 scripts/factoryctl.py session start` and use only its
   compact projection (app, lifecycle stage, active run/task, recommendations). Then run
   `python3 scripts/factoryctl.py context route --intent-stdin` with the user's own words.
2. If facts are missing, ask at most three product-direction questions at a time — never
   skill-name questions. Useful dimensions: stage (blank idea / existing repo / shipped
   app), target platform(s), the user + their painful moment, monetization intent, target
   markets/locales, and one or two design reference apps. Skip anything already answered
   in `PRODUCT.md`.
3. Turn the answers into a routing intent and run `context route` again. Use
   `python3 scripts/factoryctl.py knowledge search --query "<the user's question>"` to find
   the relevant playbook/checklist; load only the selected refs.
4. Present the smallest useful next step with both invocations (Claude `/command` and
   portable `$source-command-...`), the knowledge doc to read, and the role lens. If the
   user is starting from nothing, the likely route is `/new-app`; for a reference or a fully
   automated run it is `/factory-run`; for an existing repo it is `/continue-app`.
5. Never advance lifecycle stage, approve a protected file, spend, deploy, publish, or
   mutate an external system from this command. Those remain explicit human decisions.
6. If the local catalog has no high-confidence fit, offer the `/find-skills` path
   (`docs/playbooks/skill-discovery.md`) but install nothing without exact approval.

Output:

```text
GUIDE — <app or "new idea"> · <lifecycle stage>
Understood: <one line>
Open questions: <0-3 product-direction questions, or "none">
Recommended next: <capability title>
  Run: <Claude invocation> | <portable skill invocation>
  Read: <knowledge doc path>
  Why now: <one line>
Alternatives (max 2): …
Human decisions needed: …
```

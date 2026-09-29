---
description: Design or restyle a web page grounded in its subject, with pinned design skills and measured browser evidence
argument-hint: [page or goal]
---

Run the web design workflow for: **$ARGUMENTS**

Read `docs/playbooks/web-design.md`, `docs/stack/web.md`, `docs/playbooks/skill-discovery.md`,
and the "Web" sections of `docs/checklists/accessibility.md` and
`docs/checklists/performance.md`. For a 3D or WebGL surface, route to `/web-3d` instead.

1. State the concrete subject, audience, and job the page serves. If the brief does not
   supply them, ask — do not design around a guess.
2. Verify the pinned sources in the playbook still match upstream
   (`python3 scripts/check_pins.py`); stop for review on drift. Request approval for the
   exact source, skill(s), and destination; install project-local with the `--skill` subset
   form. Never install with `-g`, never install a whole pack, never install a style preset.
3. **Plan pass.** Produce the token system before markup: 4–6 named colors each with its
   subject reason, display and body typefaces, spacing/type scale, and one signature element.
4. **Critique pass.** Check the plan against the three forbidden defaults and against the
   brief. Revise anything that reads as a default rather than a choice for this project, and
   state what changed. Only then build.
5. Build the page. Reuse existing tokens and components; no raw hex or magic spacing in
   markup; every string goes through the message catalog.
6. Gather evidence: production build, clean console, full-page screenshots at 360 and 1280,
   keyboard-only pass, Core Web Vitals and WCAG numbers, and the grounded-vs-default answer
   for palette, typefaces, and signature element.
7. New dependencies, protected files, provider writes, and publishing keep their normal
   approval gates. Never invent testimonials, ratings, awards, or metrics.

Output:

```text
WEB DESIGN REPORT — <page> · <subject>
Subject / audience / job: …
Skills installed (source@revision): …
Token plan → critique changes: …
Signature element: …
Grounded vs default (palette / type / signature): …
Build + console: …
Screenshots (360 / 1280) + keyboard pass: …
CWV + WCAG numbers: …
Remaining risks / human actions: …
```

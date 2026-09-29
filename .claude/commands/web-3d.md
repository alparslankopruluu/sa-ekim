---
description: Build or improve a Three.js/WebGPU scene, browser game, or 3D configurator with pinned expert skills and measured browser evidence
argument-hint: [goal]
---

Run the web-3D workflow for: **$ARGUMENTS**

Read `docs/playbooks/web-3d.md`, `docs/playbooks/skill-discovery.md`, and
`docs/checklists/performance.md`.

1. Classify the job: scene/materials/effects, complete browser game, or WebGPU/TSL.
   State the classification and the smallest matching skill subset from the playbook.
2. Verify the pinned sources in the playbook still match upstream
   (`python3 scripts/check_pins.py`); if a pin drifted, stop for review before
   installing anything.
3. Request approval for the exact source, skill(s), and destination. Install
   project-local with the `--skill` subset form. Never install with `-g`, install a
   whole pack, or auto-run a newly installed skill.
4. Scaffold or extend the project (for games, use the pack's Vite + TypeScript
   scaffold with its deterministic test hooks and seeded RNG), then build.
5. Gather the playbook's evidence: production build, clean browser console,
   active-interaction screenshot, canvas non-blank-pixel metrics, mobile-viewport
   pass, main-path interaction check, and a frame-budget/draw-call snapshot. Optional
   generator keys stay in the human's shell or server config; a missing key downgrades
   to placeholder assets and never blocks.
6. New runtime dependencies, protected files, provider writes, and publishing keep
   their normal approval gates.

Output:

```text
WEB-3D REPORT — <app> · <goal>
Job class + skill subset installed (source@revision): …
Build + console: …
Visual evidence (screenshot, canvas metrics, mobile pass): …
Performance snapshot (frame budget, draw calls, textures): …
Remaining risks / human actions: …
```

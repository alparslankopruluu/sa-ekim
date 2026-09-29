---
description: Prepare release-candidate store metadata, icons, localized screenshots, and safe upload plans
argument-hint: "[--platform=ios|android|both] [--kind=screenshots|metadata|icons|all] [--locales=project|launch|extended|csv] [--review=calibrate|sequential|batch] [--style=clean|stickers|protected-grade] [--resume]"
---

Prepare store assets for `$ARGUMENTS`. Follow
`.agents/skills/source-command-store-assets/SKILL.md` as the complete execution contract.

Parse only the documented flags. Detect the platform from real project files when absent.
Before creative work, verify `store-assets` availability through `factoryctl capability
list --stage release`. If the release-candidate/M1/M2 gate is not ready, queue
`store-assets` for `after-milestone`, report prerequisites, and stop without scaffold,
capture, render, provider, metadata, final icon, or upload work.

For iOS screenshots, use the bundled pinned runtime at
`.agents/skills/source-command-store-assets/vendor/hypershots`; do not install or fetch a
different HyperShots copy. Produce the clean real-capture set, render/inspect/repair every
locale, validate, and show the review gallery before offering any paid protected style
pass. ASC plan/apply/readback remains the only iOS upload path. Android keeps the native
Play asset pipeline. External writes, provider spend, signing, and publishing always need
their exact approval gates.

For metadata localization, resolve the project's real target locale matrix and read
`.agents/skills/source-command-store-assets/references/metadata-localization.md`. Rewrite
each market independently from shipped facts instead of translating literally. Calibrate
the source locale once, then cover every target locale with per-field counts and evidence;
never silently substitute the launch-nine profile. Canonical store metadata remains the
upload source and apply still requires exact approval.

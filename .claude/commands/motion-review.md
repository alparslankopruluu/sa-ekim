---
description: Review native SwiftUI or Expo motion, gestures, transitions, and haptics without changing code
argument-hint: [path | feature | diff]
---

Review motion scope: **$ARGUMENTS**

Read `docs/checklists/motion-quality.md`, `docs/playbooks/design.md`,
`docs/checklists/performance.md`, and `docs/checklists/accessibility.md`. Review only
animation, transition, gesture, sheet, drag/swipe, and haptic code in the named scope or
current diff. Do not modify code, add dependencies, or review unrelated architecture.

For every finding, use this table:

| Severity | Before | Native-safe direction | Why / evidence needed |
|---|---|---|---|

Review purpose/frequency, scoped SwiftUI animation or Reanimated UI-thread ownership,
gesture interruption/re-targeting, motion personality, haptic causality, Reduce Motion,
performance/jank risk, Dynamic Type/dark-mode state changes, and real-device proof.

End with exactly one verdict:

- **BLOCK** — a checklist blocker remains.
- **APPROVE** — no blocker; list any manual device proof still required.

If the scope is web/admin/landing code, the installed `$review-animations` Codex skill may
be invoked explicitly for its web-specific review; never apply its CSS prescriptions to
SwiftUI or Expo without translating them through the native checklist.

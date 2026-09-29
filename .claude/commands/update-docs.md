---
description: Audit the memory bank against recent changes and repair drift
---

The memory bank (PRODUCT.md + docs/) must reflect reality. Audit and repair:

1. Find the last commit that touched `docs/` or `PRODUCT.md`; collect `git log --stat` since then.
2. For each code change, check the **Documentation Update Table** in AGENTS.md (imported by CLAUDE.md) — was the required doc updated?
   - Product goal/vision/strategic boundary → `PRODUCT.md` current; deferred work in `docs/backlog.md`?
   - Market evidence/score/unit economics/distribution → `PRODUCT.md`; screen/state acceptance → `docs/product-map.md`?
   - Funnel/launch/experiment → `docs/growth-plan.md`; data/SDK/threat/review risk → `docs/security-model.md`?
   - Motion personality/animation/gesture/haptic behavior → product map + design playbook + motion-quality checklist?
   - Completed/next work → `docs/mvp-plan.md` current milestone and checkboxes accurate?
   - New screens/features → `docs/features.md` rows present?
   - Firestore/rules/Functions changes → `docs/data-model.md` current?
   - New deps/toolchain/commands/services/patterns → `docs/stack.md` + `docs/architecture.md` + `docs/decisions.md` as applicable?
   - Folder/service/navigation changes → `docs/architecture.md` matches the actual tree and data flow?
   - Paywall/pricing changes → PRODUCT.md monetization section?
   - New events/locales → the tables in `docs/playbooks/analytics.md` / `docs/playbooks/localization.md`?
   - Setup, repo map, headline status, or release changed → concise `README.md` current?
   - Factory surface changed → strategy/task graph, architecture, engineering/security, growth, provider, and rejection owners current?
   - Android source/state changed → `docs/android-parity.md` matches verified iOS/Android behavior, tests, exceptions, and delivery evidence?
3. Fix every gap you find (write the missing rows/sections yourself from the code — don't ask the user to).
4. Reject conflicting duplicate facts: keep the canonical doc as owner and replace secondary detail with a short summary/link. `.factory/run-state.json` and `.factory/android-state.json` are ephemeral views, never project memory; never mark parity from file presence alone.
5. Verify CLAUDE.md and AGENTS.md snapshots agree with reality, remain under 150 lines, and their memory rules are identical.
6. Report: what drifted, what you fixed, and any recurring drift pattern worth a new rule.

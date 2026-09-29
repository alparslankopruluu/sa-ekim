---
description: Diagnose the app funnel and propose one evidence-backed growth experiment
argument-hint: [--window=auto|7d|28d]
---

Run the growth operating loop for: **$ARGUMENTS**

Read `docs/playbooks/growth-loop.md`, `docs/growth-plan.md`, PRODUCT.md,
`docs/playbooks/analytics.md`, and recent experiment rows in `docs/decisions.md`.
For channel execution (creators, meme pages, UGC, paid ads) read
`docs/playbooks/distribution.md`.

1. Accept only `--window=auto|7d|28d`; default `auto`.
2. Read aggregate ASC, RevenueCat, and Firebase/GA metrics with available authenticated
   tools after confirming their current help. If a source is unavailable, request a
   secret-free aggregate CSV under `.factory/growth-input/`; if a factory state exists,
   add a precise human action. Never request API keys, raw users, or PII.
3. Normalize aggregate counts to the schema accepted by
   `python3 scripts/growth_diagnose.py .factory/growth-input/funnel.json --window <value>`;
   run it before interpreting a bottleneck. Verify freshness, build/release and cohort parity, tracking gaps, active experiments,
   and sample sufficiency. `auto` uses current/prior 7 complete days only when both have
   ≥100 downloads and ≥20 paywall views; otherwise current/prior 28 complete days.
4. Compare impression → page → download → activation → paywall → trial/purchase → paid
   → D1/D7 retention. Missing evidence stays `unknown`; never invent causality.
5. Select the largest verified bottleneck and propose exactly one experiment with a
   hypothesis, primary metric, guardrail, minimum runtime/sample, stop condition,
   expected direction, and next measurement date.
6. Update the canonical funnel/experiment backlog in `docs/growth-plan.md` and append one
   experiment row to `docs/decisions.md`. Do not duplicate PRODUCT or analytics facts.
   If the bottleneck is App Store page conversion or audience-message fit, route the
   selected CPP/PPO/creative/event operation through `/app-store-growth` instead of
   inventing commands here.
7. Stop for explicit approval before Remote Config/Firebase A/B, RevenueCat Experiments,
   PPO/CPP, In-App Events, prices, notifications, email, review responses, or any remote
   mutation. Never create an ad campaign or spend money. Never promise downloads, payout,
   retention, or causality.

Output:

```text
GROWTH REPORT — <app> · <window/cohort>
Sources/freshness: …
Funnel current vs prior: …
Verified bottleneck + confidence: …
One experiment + guardrails: …
External approval required: yes/no — exact mutation
Next measurement date/action: …
```

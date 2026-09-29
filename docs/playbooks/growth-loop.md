# Growth Loop

*Read when creating `docs/growth-plan.md`, running `/growth-loop`, or choosing a post-launch experiment.*

## Safety and data truth

Growth analysis is read-only until the user approves an exact mutation. Never start or
change Remote Config/Firebase A/B Testing, RevenueCat Experiments, PPO/CPP, In-App Events,
prices, ads, notifications, emails, or review responses without separate approval.
Never spend money automatically.

Prefer authenticated provider reads. Confirm current commands with installed tool help.
If ASC, RevenueCat, or Firebase/GA analytics cannot be read safely, request a human CSV
export into `.factory/growth-input/`; keep it gitignored, secret-free, and aggregate-only.
Missing data stays `unknown`. Do not infer downloads, revenue, retention, or causality.
Paid market-intelligence estimates are not required or used by default.

Normalize reads/CSVs into `.factory/growth-input/funnel.json` and run
`scripts/growth_diagnose.py`. The aggregate-only shape is:

```json
{
  "quality": {"trackingValid": true, "cohortsComparable": true, "overlappingExperiment": false},
  "windows": {
    "7d": {"current": {}, "previous": {}},
    "28d": {"current": {}, "previous": {}}
  }
}
```

Period keys used when available: `impressions`, `product_page_views`, `downloads`,
`activations`, `paywall_views`, `trials`, `trial_paid`, `d1_eligible`, `d1_retained`,
`d7_eligible`, `d7_retained`. Values are non-negative aggregate counts or omitted;
numerators cannot exceed their denominators. `trial_paid` means trials that converted,
not all paid users or direct purchases.

## Window and sufficiency

- `auto`: compare latest 7 complete days with the prior 7 when both have ≥100 downloads
  and ≥20 paywall views; otherwise use the latest/prior 28 complete days.
- Explicit `7d` or `28d` uses that window but still reports insufficient sample.
- A provider outage, tracking gap, release mix, price change, or overlapping experiment
  invalidates a clean comparison; repair measurement before optimization.

## Diagnostic order

Normalize the funnel without blending incompatible cohorts:

```text
impression → product-page view → download → activation
→ paywall view → trial/purchase → paid → D1/D7 retention
```

1. Verify event/source freshness, release/build, locale, and denominator parity.
2. Compare current vs prior window and segment only when sample permits.
3. Select the largest evidence-backed bottleneck that the product can influence —
   except that retention outranks acquisition: retention is the single most important
   growth ingredient, and `growth_diagnose` prefers a verified D1/D7 retention
   regression over acquisition-stage regressions regardless of magnitude, because
   fixing acquisition while retention leaks is the classic wasted year. The churn-fix
   recipe: the viral feature acquires, the useful feature retains — pick retention
   features from observed churn evidence, not invention. (Noise on tiny funnels is
   already bounded by the sufficiency gate above.)
4. Propose exactly one primary experiment for one surface.
5. Record hypothesis, primary metric, guardrail, minimum runtime/sample, stop condition,
   expected direction, and evidence in `docs/growth-plan.md` and `docs/decisions.md`.
6. Ask for approval only if applying a remote mutation. Otherwise hand off the exact next read/test.

Do not prescribe referral, push, discounts, or paid acquisition by default. Use them
only when PRODUCT.md explains the user value, channel fit, and trust/unit-economics boundary.
Content cadence and creative volume are hypotheses measured against one primary metric,
not fixed recipes. Never recommend undisclosed founder promotion, fake discovery stories,
fake accounts/reviews, planted/seeded comments, incentivized reviews, purchased
engagement/followers, community spam, or engagement manipulation.

## Output

Report source freshness, window/cohort, funnel table, biggest verified bottleneck,
confidence/limitations, one experiment, guardrails, whether an external approval is
needed, and the next measurement date. High downloads or payout are never guaranteed.

# Monetization Models

*Read this when: choosing or changing the revenue model, credits logic, or pricing strategy. The chosen model is recorded in PRODUCT.md.*

**Charge from day one — revenue is the marketing budget.** For a bootstrapped app,
charging is not how users are monetized later; it is what funds acquiring the next
users, and it is the only validation signal that isn't a proxy. "Free now, ads later"
hides the truth for months. The free tier exists to demonstrate value in onboarding,
never to live on. The kit's ladder stays weekly + annual (below) — do not import a
$9.99-monthly default from generic guides.

## Model A — Subscription-first

- Everything premium behind the single `pro` entitlement. Weekly + annual (see `docs/playbooks/paywall.md`).
- Choose when value is ongoing/recurring: habit tracking, content, utilities, coaching.
- Free tier: just enough to demonstrate value in onboarding — not enough to live on.

## Model B — Hybrid: subscription + consumable credits

For apps where each core action has real marginal cost (AI inference, media processing).

- Subscription (`pro`) grants a **monthly credit allowance** + perks (priority, higher quality). Consumable top-up packs (`{{BUNDLE_ID}}.credits.<n>`) for heavy users.
- Free starter credits sized so a new user reaches the wow moment (2–3 core actions) — no more.
- **Credit ledger rules (non-negotiable):**
  - Balance lives in Firestore (`users/{uid}/wallet`), written ONLY by Cloud Functions. Client reads, never writes (`docs/data-model.md`).
  - Grants happen in the RevenueCat webhook Function on `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE` events.
  - Spends are atomic Firestore transactions server-side, in the same Function that performs the paid action (AI proxy).
  - Failed actions refund automatically in the same transaction scope.
- Alternative to hand-rolled ledger: RevenueCat Virtual Currencies. [verify GA status + RN support when implementing]

## Kickoff decision rule

| Signal | Model |
|---|---|
| Core action has per-use backend cost (AI calls, rendering) | **B** — costs must be metered |
| Flat cost to serve; value is access/ongoing | **A** |
| Tempted to do consumables-only | **Never** — no MRR base, no compounding revenue |

## Pricing ladders (starting points — validate with Experiments, not app updates)

- Subscription: weekly $3.99–7.99; annual ≈ **8–10 weekly units** (so $3.99/wk → ~$34.99/yr, $6.99/wk → ~$59.99/yr — do the math from the chosen weekly, don't pick independently). AI-heavy apps trend to the upper band.
- **Competitor-pricing onboard-through (at kickoff):** install and onboard through the
  top 3–4 category apps; record each paywall's structure, prices, trial shape, and the
  exact moment you feel compelled to buy, with dates, as evidence. Set the weekly anchor
  from that observation, not from the generic band alone.
- Credits (Model B): 3 pack sizes (starter / plus / studio, e.g. 10/25/60 units) with per-unit price dropping ~20–30% per tier; align unit economics to ≥70% gross margin on the underlying API cost.
- Storefront-localized pricing: `docs/playbooks/paywall.md`.

## Metrics & targets

| Metric | Target / warning |
|---|---|
| Onboarding completion | ≥70% |
| `paywall_view` → `trial_start` | starting anchor ≥8–12% for an onboarding paywall [verify vs RC benchmarks per category]; set the project target in PRODUCT.md |
| Trial → paid | 3-day trials ≈25–30% median; 17–32-day trials ≈42% median (RC 2026) |
| Refund rate | >2–3% = investigate paywall honesty/expectations |
| Month-1 ARPU | ≥ $2 per download (prose target — the growth funnel schema stays counts-only; compute from RC revenue / month-1 downloads) |
| MRR / churn | RC dashboard; review weekly |

- Every pricing/paywall experiment = one hypothesis + one primary metric + minimum runtime, logged in `docs/decisions.md`.

## Automation split

| Claude automates | Human does |
|---|---|
| Ledger Functions + rules, webhook handler, credit UI, metric event wiring, experiment scaffolding, margin math from API price sheets | Chooses model at kickoff, approves price points, monitors RC dashboard, decides experiment winners |

# PRODUCT — Kök

*Single source of truth for WHAT we are building and WHY. Filled at kickoff on 2026-09-29; the
product owner approved the design ("devam et bitir… çok indirilsin, işe yarasın") and fixed
these inputs: name **Kök** (working name), global launch in **20 languages**, Türkiye first,
then the Arab world and the USA, **no free trial**, weekly $7.99 / monthly $12.99 / annual
$39.99, credit packs sold on top. Every other kickoff decision was delegated to the agent;
one-way doors (name, bundle id, prices, provider spend) are flagged in `docs/decisions.md`.*

## Pitch

Kök is the hair-transplant companion: see an AI preview before the operation, then
photograph the same angle for 12–18 months while the app shows what week you are in, what
is typical for that week (shock loss, the quiet months) and what to do next.

## Target user & trigger moment

- **Who:** adults 22–50 who are researching, have booked, or have just had a hair
  transplant (hairline, crown, parting, eyebrows, beard) — men first by volume, women a
  fast-growing second segment (parting/crown, brows, PRP/mesotherapy courses). Markets in
  order: Türkiye, Arab world (KSA/UAE/Iraq/Egypt), USA, then UK/DE/RU/FR/ES/BR and Asia.
- **Painful moment that makes them open the app:** week 3 – the transplanted hairs fall out
  and the mirror looks worse than before surgery; they wonder whether the operation failed.
  Second peak: months 2–4, when nothing seems to grow.
- **Existing alternatives & our wedge:** clinic WhatsApp groups and Reddit threads (no
  structure, no memory); recovery apps (HairSync, Capila, Hair Back, Hair Track, Follicle,
  Hairgen — see evidence). Kök's wedge is the *combination none of them ships*: (1) the
  typical phase overlaid on **your own** photo series, (2) a shed log tied to the phase,
  (3) women's parting/PRP and eyebrow/beard tracks, (4) a before-op preview that starts the
  same file, (5) first-class Turkish and Arabic (and 18 more languages).

## Opportunity thesis

- **Evidence summary** (public-only scan on 2026-09-29; `sourced` unless marked):
  - Market: ISHRS Practice Census reports >703,000 surgical procedures worldwide in 2021;
    women were 12.7% of surgical patients in 2021 and 15.3% in 2024, and ISHRS separately
    reports female patient counts +16.5% from 2021 to 2024 (member-survey data; counts
    patients, not procedures; share and count are different measures). Allure (23 Sep 2026)
    reports men flock to "Hairstanbul" and a growing number of women now do too, citing
    ~1M travellers a year and packages of $2,600–3,600 vs $20,000+ in the US.
    Country-level hair-transplant flows for USA/UK/DE/Gulf/Iran/RU are `unknown`.
  - Competitors (`observed` from store pages): HairSync (7-day trial, ~$14.99/mo · $79.99/yr,
    from a search snippet — verify), Capila (free/unverified), Hair Back (free, clinic
    consults), Hair Track (free, Harley Street clinic lead-gen), Follicle (ghost-overlay
    camera, freemium), Hairgen.ai (AI simulator, 3.0★ / 2 ratings, ads), HairLoss AI
    (4.4★ / 238, $9.99/wk · $44.99/yr), Regrow AI ($9.99/wk), Rooty, Track Hair
    ($1.99/wk · $29.99/yr), MyHairCounts. Category weekly price $1.99–$9.99; annual mostly
    $30–60, top $79.99.
  - Gaps no app was found to cover (`observed`, absence of evidence, re-check before launch):
    women's PRP/mesotherapy session log, eyebrow/beard transplant flows, a shed log tied to
    the expected phase, preview + 12–18-month timeline in one file, Arabic/Turkish-first UX.
  - Recurring complaints (thin, few reviews; `observed`): shallow AI assessment behind a
    paywall, bad top-of-head photo angles, distrust of uploading face photos, motivational
    rather than clinical tone. A reliable 1-star corpus was not retrievable.
  - Standard timeline (`sourced` from clinic blogs; no single authority): scabs 7–14 days;
    shock loss weeks 2–8; "ugly duckling" months 2–4; first growth months 3–4; density
    builds through months 6–9 (clinic figures vary widely, so Kök shows only a wide
    illustrative band, never a percentage); maturation 9–12; evaluation at 12 months;
    crown and women up to 18–20 months. Clinic blogs, not a single authority.
- **Evidence strength:** moderate for market and timeline, weak for willingness to pay and
  conversion (`unknown` until launch).
- **Positioning:** For people about to have or recovering from a hair transplant, Kök is the
  companion that shows your own photos next to what is normal for your exact week, because
  it turns the 12–18-month wait into a guided, measurable timeline instead of a WhatsApp
  group.
- **Primary acquisition channel:** organic short video (TikTok/Reels/Shorts: week-N
  before/after timelines with the on-photo phase band), ASO in TR/AR/EN, and Apple search
  ads only after month-1 ARPU is measured. No clinic lead-sale in v1.
- **Gotcha moment (one sentence):** Your own week-3 photo, with a band that says "shedding
  around now is typical — here is what usually comes next." (App Review 1.4.1: the app only
  knows the date, so it states what is *typical*, never that you are fine.)
- **Three-second demo / before-after proof:** the before/after wipe slider on the preview,
  and a week-N photo with the expected-phase band; understandable with sound off.
- **Video-ready core state:** the Result screen (preview wipe) and the Journey compare
  screen (side-by-side with week label).
- **Opportunity score:** 76/100 — go (thin, 1 point above the threshold). All eight inputs,
  second pass: problem-urgency 12, retention 13, monetization 12, distribution 11,
  differentiation 12, technical-feasibility 7, trust/review-feasibility 6, defensibility 3.
  First pass was 69 (`reposition`: 12/12/11/10/10/7/5/2) before the wedge was narrowed to
  the post-op companion. `--critical-risk` is off because the medical-adjacent review risk
  is mitigated by design (no diagnosis, vendors named, photos local) rather than an
  unavoidable blocker, and the tarpit screen passes only through the phase-overlaid journey.
  Scores are judgment calls; see `docs/decisions.md` D-002.
- **Critical business risks:** (1) medical-adjacent review risk (App Review 1.4.1, 5.1.1,
  5.1.2(i)) — mitigated: no diagnosis, no outcome promises, vendors named in consent,
  photos local by default; (2) AI hair edits on real photos are unproven — identity drift
  and "invisible edit" failures are documented in the Simetra repo; the preview must clear a
  real-photo QA bar before launch; (3) tarpit screen: AI hair simulators are crowded, so the
  simulation is *not* the moat — the phase-overlaid journey is; (4) willingness to pay for a
  free-alternative category (clinic apps are free) is unproven.

## The ONE core feature

> Stay consistent for 12–18 months: a same-angle photo series with the typical phase for
> your week, so a typical shedding week never feels like a failed operation.

**"Exceptionally well" bar** — the core feature is done only when:
- A new user who sets the operation date sees the correct day/week/phase, the phase's
  "what is normal" message and the next task within 10 seconds, offline, in their language.
- The capture screen only accepts a photo when the phone is upright (accelerometer gate) and
  overlays the previous photo as a ghost, so same-angle photos line up without manual
  alignment; Pro adds wipe and side-by-side compare.
- Reminders arrive on schedule (local notifications) and never claim a medical result.

## Vision and strategic boundaries

- **Long-term outcome:** the default record of a hair-restoration journey worldwide —
  transplant, PRP/mesotherapy, eyebrows, beard — that clinics recommend because their
  patients arrive prepared.
- **What this MVP must prove:** strangers pay to keep the timeline (paywall → purchase
  ≥ 4%) and come back for the weekly photo (D7 ≥ 20%, week-4 photo compliance ≥ 40%).
- **What this product will not become:** a diagnostic tool (no Norwood stage, no "you have
  alopecia"), a graft-count/price promiser, a clinic lead-selling marketplace, or an
  ads-funded app that shares face or scalp photos.

## Monetization

- **Model:** B — hybrid subscription + credits (every preview has a provider cost).
- **Entitlement:** `pro` · **Offerings:** `default`, `gift_discount`, `credits`
  (`onb_discount` from the kit maps to `gift_discount`; see decisions D-004).
- **Price points (owner-fixed 2026-09-29):** weekly **$7.99** · monthly **$12.99** ·
  annual **$39.99** · **no free trial anywhere** · credit packs 10 / 25 / 60 at
  $4.99 / $9.99 / $19.99. Storefront-localized tiers for TR, SA/AE/EG, IN, ID, BR, MX
  (`asc-ppp-pricing` at catalog time). Prices always come from the store, never the code.
- **Free tier / starter credits:** free forever = the first-14-days care guide, the
  shed log, 3 progress photos with the ghost overlay, and **one** watermarked standard
  preview (onboarding). Pro = unlimited photos, compare wipe/side-by-side, typical-phase
  band, full weekly guide and phase/photo reminders, "same-week" cohort, clinic PDF report,
  plus a credit allowance (weekly 12/wk, monthly 24/mo, annual 10 at purchase then 6/wk).
  Previews cost credits for everyone (standard 1, high 3; high needs no entitlement and
  neither tier is watermarked — only the free onboarding preview is).
- **Paywall placement:** after the first real preview at the end of onboarding
  (tease-then-gate), and on locked features (compare, band, report, HD, extra photos).

## Unit economics & launch thesis

- **Marginal cost per core action / active user:** preview ≈ $0.05 standard / ≈ $0.19 high
  (fal `gpt-image-2` output tokens, Simetra 2026-07 measurement — re-verify before launch).
  The journey itself is local and costs $0. Free user cost ≈ $0.05 once.
- **Gross-margin target:** ≥ 70% on net proceeds at *expected* use (assumed ≤ 40% of the
  allowance spent). Fee assumption everywhere: 30% store commission (`assumption`). Worst-case
  burn if every credit goes to high previews: weekly 12/wk ≈ $0.76 vs ≈ $5.59 net; monthly
  24/mo ≈ $1.52 vs ≈ $9.09; annual 10 + 6/wk ≈ $20.4 vs ≈ $27.99; the gift annual
  ($23.99, net ≈ $16.79) loses money in that worst case, so it relies on expected use.
  Remote-Config tunable on the server.
- **Break-even CAC ceiling:** `unknown until retention data`; paid UA stays off until
  month-1 ARPU ≥ $2 is measured.
- **90-day distribution thesis:** TR/AR/EN short videos from real (own, consented) timelines
  and the preview wipe; clinic-agnostic "day 0" share card; ASO on "hair transplant
  recovery / timeline / saç ekimi / زراعة الشعر".
- **First organic creative hook:** "Week 3 of my hair transplant and I'm shedding — the app
  shows me what's typical around now."
- **Go/kill criteria:** continue if by day 60: paywall→purchase ≥ 4%, D1 ≥ 25%, D7 ≥ 20%,
  week-4 photo compliance ≥ 40%. Reposition if paywall→purchase < 2% after two paywall
  experiments; kill if provider cost exceeds 40% of net revenue.

## Success metrics (first 90 days) — all targets are assumptions, no measured baseline yet

| Metric | Target |
|---|---|
| Onboarding completion | ≥ 70% |
| Paywall view → purchase (no trial) | ≥ 4% |
| Purchase retention (2nd weekly renewal) | ≥ 50% |
| D1 retention | ≥ 25% |
| Month-1 ARPU | ≥ $2 |
| MRR milestone | $1K by day 90 (assumption; rung 2 of the ladder in growth-plan.md) |

## Launch locales

20 locales, all bundled from day one (kit `extended` profile minus `da`, `nb`):
en, tr, ar, ja, zh-Hans, ru, es, pt-BR, de, fr, it, ko, zh-Hant, id, vi, th, hi, nl, pl, sv.
Arabic is RTL. Turkish and English are the source pair; the rest are translated and
reviewed by a native-speaker pass before store submission (see `docs/decisions.md` D-006).

## App Store presence

- **Product-page narrative:** preview it → set day 0 → photograph the same angle → see what
  is typical this week. Lead with the outcome ("see what's typical for your week").
- **Screenshot 1 benefit:** "See what's typical for your week of recovery"
- **Screenshot 2 benefit:** "Shedding in week 3? See what's typical"
- **Store name (D-019):** `Kök: <top search term>` per locale — en "Kök: Hair Transplant Tracker", tr "Kök: Saç Ekimi Takibi", ar "Kök: متابعة زراعة الشعر" (`metadata/store-names.json`).
- **Supported listing locales:** en-US, tr, ar-SA, ja, zh-Hans, ru, es-ES, pt-BR, de-DE,
  fr-FR, it, ko, zh-Hant, id, vi, th, hi, nl-NL, pl, sv
- **CPP audience / intent+keyword / creative / deep link / analytics:** planned-surgery
  researchers / "hair transplant simulator" / preview wipe / `kok://simulate` / `cpp=plan`;
  recovering patients / "hair transplant timeline shedding" / typical-phase screenshots /
  `kok://journey` / `cpp=recover`.
- **PPO hypothesis / variable / metric / sample / duration / stop:** a typical-phase screenshot 1
  beats a preview-wipe screenshot 1 / screenshot 1 only / conversion rate / Apple default /
  ≥ 14 days / stop at 90% confidence or 28 days.
- **In-App Event opportunity:** quarterly "Growth month" challenge (photo streak within the
  user's own journey, no incentives to review) — concrete plan after launch data.
- **Header/search-result creative:** preview-only until live tool support is proven.

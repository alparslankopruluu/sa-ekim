# Product Strategy Gate

*Read when starting `/new-app` or `/factory-run`, changing positioning, or reconsidering whether an app should be built.*

## Evidence before opinion

Research at least five direct competitors plus relevant substitutes using public store
listings, websites, prices, screenshots, visible flows, and review themes. Record URLs
and observation dates in evidence. Connected ASO/research tools may deepen the work but
must never be required to reach a transparent decision.

The default evidence lane is public-only: store listings/reviews, product sites, pricing,
update history, public Reddit/X discussion when available, and public ad-transparency
libraries. Sensor Tower, AppTweak, data.ai, Gooseworks, paid ASO estimates, or scraped
private data are neither required nor the default. If downloads, revenue, ad spend, or
organic growth cannot be publicly verified, record `unknown` or a labeled assumption.

Cover: promise, target user, core loop, pricing, monetization, ranking/keyword position,
first-three screenshot story, repeated praise/complaints, retention mechanism,
distribution channel, and design patterns. Never copy code, brand, icon, screenshots,
trade dress, or store text.

Mine each competitor's 1-star reviews explicitly: record the top three recurring
complaints per competitor — each one is a wedge candidate. Comment sections under niche
creators and 1-star reviews are where people tell the truth; friendly interviews are not.
Build for observed behavior, never stated preference: consumer interviews are unreliable
narrators, so the consumer version of "get out of the building" is publishing an honest
demo and watching whether strangers stop, and putting a paywall in front of people and
watching whether they pay.

### Review mining method

Work review evidence as a pipeline: extract, resolve, rank, cite. Extract each complaint
or praise as a schema-shaped row — theme, verbatim quote, review ID, date, star rating —
never as a loose impression. Then resolve theme variants semantically before counting:
"crashes on open" and "app won't start" are one theme, and plain string matching misses
that merge, so deduplicate by meaning, not wording. Rank themes by deduplicated frequency
across competitors; that frequency is the wedge signal, and raw un-merged counts are
noise. Every ranked theme keeps its supporting review IDs and dates; a theme that cannot
cite its reviews is an `assumption` under the labeling rule below, not evidence.

Also test whether the value is understandable in three seconds, whether the core outcome
can be shown honestly in a screen recording or before/after proof, and whether the core
job fits one sentence. Treat public organic discussion and review velocity as directional
distribution evidence, never as proof of revenue or causality.

Do not invent market size, search volume, revenue, CAC, LTV, or conversion. Mark each
claim `observed`, `sourced`, or `assumption`. A basic name/trademark check is a risk
screen, not legal clearance.

## Tarpit and clone screen

Some ideas look like solid ground and are not: obviously useful, easy to explain, many
dead identical apps behind them (AI habit tracker, AI journal, AI meal planner, AI
flashcards, generic chat wrappers). If the app is identical to five existing apps, the
only competitive axis left is marketing — the axis a first-time founder is weakest on,
against studios with ad budgets. An improved clone is valid **only** with a stated,
screen-visible insight that produces something observably different in the core loop;
"mine will be better designed" is not an insight. A failed clone screen is a critical
risk: record it and pass `--critical-risk` to `opportunity_score.py` (hard `no_go`).
Ignore competitors emotionally, read them forensically — their paywalls, onboarding
flows, and public ad libraries are the cheapest research available.

## Narrow niche

Optimize for the intensity of the feeling, not the size of the audience: a hundred
people in a nameable niche who love the app beat a million who sort of like it, because
the hundred review, retain, and tell their teammates. A narrow niche is a distribution
advantage — you know exactly who the customer is, where they gather, and what they
watch. Expansion is earned after the niche is owned, never planned into v1.

## Gotcha moment (canonical definition)

The gotcha moment is the one feature that stops the scroll: a stranger watching a
5-second screen recording with the sound off must understand the entire thesis of the
app, and it must fit one sentence. If it does not compress into one sentence, that is
the idea talking, not a copywriting problem. Validate it by reverse-engineering the
promotion before building: who watches this niche's videos, what problem do they have,
and how would a specific creator show this app in 30 seconds without it feeling like an
ad? **If you cannot picture the promotion video, skip the idea.** The existing fields
map onto this concept — `{{DEMOABILITY}}` (PRODUCT.md) is its honest-proof form,
`{{TRIGGER_MOMENT}}` its problem side, and `{{ACTIVATION_MOMENT}}` (product-map.md) its
in-app landing; they reference this definition rather than defining parallel concepts.

## Deterministic opportunity score

Score with `python3 scripts/opportunity_score.py score ...`; do not add weights mentally.
Exit `0` means `go`; exit `3` is the expected reposition/no-go gate, not a command crash;
exit `2` means invalid input.

| Dimension | Max | What earns the score |
|---|---:|---|
| Problem urgency | 15 | costly/frequent pain with clear trigger |
| Retention potential | 15 | repeated job or durable saved value |
| Monetization | 15 | credible willingness to pay and healthy margin |
| Distribution | 15 | reachable audience and plausible channel advantage |
| Differentiation | 15 | original wedge visible in core loop and an honest demo, not copy alone |
| Technical feasibility | 10 | MVP can meet the quality bar with known constraints |
| Trust/review feasibility | 10 | claims, data, safety, and policy risks are controllable |
| Defensibility | 5 | compounding data/workflow/brand advantage |

- `go`: total ≥75, no critical risk, and monetization/distribution/differentiation each ≥8.
- `reposition`: total 60–74 with no critical risk and no weak critical dimension.
- `no_go`: total <60, any critical risk, or any critical dimension <8.

Only `go` may enter product blueprint/build. For `reposition` or `no_go`, propose a
narrower ICP, stronger core-loop wedge, channel change, or monetization change; research
and score the revision, then obtain approval. Never lower the score to force progress.

## Compact role review

- **CEO/strategy:** opportunity, focus, unit economics, channel, go/kill criteria;
  which MRR-ladder rung are we on and what does this week's work do for it
  (`docs/growth-plan.md`); is this decision a one-way or two-way door — two-way
  (pricing, onboarding order, creator choice, icon) → decide fast; one-way (app
  name/bundle ID, equity, user-data commitments) → slow down; small goals buy morale.
- **Product owner:** one core job, screen scope, measurable acceptance, backlog fence;
  are we adding features or fixing retention?
- **Design lead:** original direction, coherent system, all states, real-device quality.
- **Tech lead:** feasible architecture, engineering-quality and operational boundaries.
- **Security/review:** category flags, data/claims risk, threat model, reviewer path.
- **Growth:** north star, funnel, launch channel, experiments without automatic spend.

These are review lenses over canonical docs, not separate verbose personas or duplicate reports.

## Where startup canon does not transfer

Most startup advice is written for venture-backed companies playing a different game:

- **Network effects / atomic networks:** a utility app is a tool, not a network — the
  hundredth user does not make it better for the first. Don't contort a utility into a
  social product because growth literature made networks sound mandatory.
- **Growth as the definition of success:** a $10k/month, 70%-margin app is a small
  software business with different physics — take the growth tactics, not the risk
  appetite or the burn.
- **Fundraising:** there is little reason to sell equity in an app built on a tool
  subscription and marketed with its own revenue; the useful residue is that every
  party treats you better when you are not desperate.
- **Move fast and break things:** the App Review boundary is where the kit deliberately
  slows down — a rejection costs weeks and a broken release sits live until the fix is
  approved (the release gates already encode this).

## Practitioner-source boundary

The three-second demo, public-demand, and fast evidence-loop ideas were distilled from
user-provided 2026 practitioner guides. Do not copy their prose, claims, or marketing
templates. High downloads, virality, and revenue are never guaranteed.

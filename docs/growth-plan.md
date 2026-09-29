# Growth Plan — Kök

*Canonical owner for acquisition, activation, retention, conversion, launch sequencing, and experiment backlog. Metrics definitions remain in `docs/playbooks/analytics.md`.*

## Growth thesis

- **North-star metric:** Weekly active journeys with a same-angle photo logged in the last 7 days
- **Primary acquisition channel:** Organic short video (TikTok/Reels/Shorts) in TR, AR and EN, plus ASO
- **Why we can win there:** Hair-transplant timelines are a native short-video genre; the phase band on the user's own photo makes an honest, watchable proof; TR/AR-first UX is a gap in the competitor set
- **Natural sharing/referral loop:** Day-0 / week-N share card (own photo optional, phase label, small Kök mark). No incentives. <!-- "none" unless sharing is native to product value -->
- **Break-even CAC / LTV evidence:** unknown until retention data; competitor annual prices $30–80 (observed on store pages; the HairSync figure is unverified) bound LTV

## MRR ladder

**Current rung:** rung-1 <!-- rung-1 | rung-2 | rung-3; every week's work names the rung it serves -->

| Rung | Goal | How | Graduation evidence |
|---|---|---|---|
| 1 | $0 → first $100 MRR | Unscalable by design: 20 people paying (weekly $7.99 or more). DM your own network, reply to every store review personally, send the first ~100 outreach messages by hand. This is validation, not scale — if 20 humans won't pay, no creator budget fixes the idea. | 20 paying users + the sentence that made them understand the app |
| 2 | $100 → $1,000 MRR | One reliably working channel before adding a second: organic posting cadence, meme-page buys, first small creator deals (`docs/playbooks/distribution.md`). | a channel that repeats profitably for ≥2 consecutive cycles |
| 3 | $1,000 → $10,000 MRR | Paid ads — only after organic creatives already convert and the audience is known. Reinvest revenue; mind the ~1.5-month Apple payout lag. | proven creatives + ARPU/CPM math that clears margin |

Rules: **don't skip rungs** — starting at rung 3 sets money on fire. **Ramen profitable
(covers the founder's living costs) is the real milestone**, not $10k: a bootstrapped
app with a tool subscription and a $99 developer account is default-alive from day one —
nobody can make you stop, and every party (creators included) treats you better when you
are not desperate. Momentum is the managed resource; revenue is how you buy it.

## Funnel baseline

| Stage | Source | Current | Target | Evidence window |
|---|---|---:|---:|---|
| Impression → product page | ASC | unknown until launch | ≥ 3% | first 28 days after release |
| Product page → download | ASC | unknown until launch | ≥ 3% | first 28 days after release |
| Download → activation | Firebase/GA | unknown until launch | ≥ 60% set a day 0 or finish a preview | first 28 days after release |
| Paywall → purchase | Firebase + RevenueCat | unknown until launch | paywall → purchase ≥ 4% | first 28 days after release |
| 2nd weekly renewal | RevenueCat | unknown until launch | 2nd weekly renewal ≥ 50% | first 28 days after release |
| D1 / D7 retention | Firebase/GA | unknown until launch | D1 ≥ 25% / D7 ≥ 20% | first 28 days after release |

Use `unknown` when evidence is unavailable; never manufacture a baseline.

## Launch system

- **Locale keyword matrices:** canonical ASC metadata/keyword evidence paths: to be produced by /store-assets into metadata/ (TR, AR, EN first); Apple Ads popularity scores unverified
- **First-three screenshot hooks:** 1) See what's typical for your week of recovery 2) Shedding in week 3? See what's typical 3) Same angle, every week 4) See it before you decide
- **Strongest first-two screenshot benefits:** Typical-phase timeline; shedding around week 3 is typical
- **Three-second demo / video-ready state:** before/after wipe and week-N photo with phase band / Result wipe screen and Journey compare screen
- **Landing / CPP / PPO / In-App Event plan:** CPP recover + plan; PPO on screenshot 1; In-App Event quarterly Growth month after launch
- **Product-page narrative:** preview → day 0 → same-angle photos → what is normal this week
- **Supported store locales:** 20 locales, see PRODUCT.md
- **CPP mapping (audience / intent+keyword / creative / iOS 18+ deep link / analytics):** see PRODUCT.md App Store presence
- **PPO contract (one variable / metric / sample / duration / stop):** screenshot 1 only / conversion rate / Apple default / ≥ 14 days / stop at 90% confidence or 28 days
- **In-App Event opportunity or N/A reason:** Quarterly Growth month (in-journey photo consistency challenge, no review incentive) — concrete after launch data
- **Header/search-result creative plan:** preview-only until live tool support is proven <!-- local preview until live ASC support is proven -->
- **Rating and review-response moment:** Native review prompt only after the 3rd logged photo, at most once per 120 days, never during onboarding; reply to every store review personally
- **Lifecycle/retention triggers:** Local phase-change notifications, weekly photo reminder, first-14-days daily care reminders, shed-log nudge in weeks 2–8, monthly maturation check after month 6
- **Paid-channel hypotheses:** plan only: Apple Search Ads on TR/AR/EN 'hair transplant' terms after month-1 ARPU ≥ $2; no automatic spend <!-- plan only; no automatic spend -->

## Organic creative hypotheses

Cadence is a testable hypothesis, not a growth guarantee. Use real build evidence and
select only formats that fit the product: screen recording, problem→solution,
before→after, disclosed founder/user demo, or an honest listicle.

| Rank | Channel / audience | First 3s hook | Real product proof | Format | CTA | Variant | Primary metric | Stop condition | Status |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | TikTok TR/EN | Week 3 of my hair transplant and I'm shedding — the app shows me what's typical around now | Journey screen for the user's own week with phase band | screen recording + voiceover | Link in bio (disclosed founder/user account) | week 3 vs month 3 hook | 3-second view rate → profile visits | < 1% profile-visit rate after 10 posts | proposed |

Never hide the founder/brand relationship, pretend to have discovered your own app,
seed fake accounts/reviews, post planted/seeded comments on the app's own promotions,
run incentivized reviews, buy purchased engagement/followers, spam communities, or
manipulate platform engagement.

## Post-launch content operations

- **Cadence:** daily health, weekly creative, monthly strategy <!-- daily health, weekly creative, monthly strategy by default -->
- **Content pillars:** what is normal this week; before-op preview; women's parting/PRP/brows; myths vs timeline
- **Approved real product proof states:** Result wipe, Journey timeline, Compare, Shed log (real app states only)
- **X / Instagram / TikTok / Reddit account ownership:** owner-created after App Store approval; not created by the agent
- **Community/brand safety boundaries:** no medical advice, no outcome promises, no clinic ranking, no fake testimonials, AI label on preview content
- **UTM campaign/content naming:** utm_source=<platform>&utm_campaign=<pillar>&utm_content=<yyyymmdd>-<variant>
- **Publishing approval owner:** product owner

| Platform | Audience intent | Native format | Primary metric | Guardrail | Current hypothesis |
|---|---|---|---|---|---|
| X | research/answers | short threads | profile visits | no medical claims | low priority; skip in first 6 weeks |
| Instagram | before/after browsing | Reels + Stories | saves | AI label on previews | typical-phase Reels earn saves |
| TikTok | recovery reassurance | vertical timeline videos | profile visits | disclose founder relationship | week-3 shedding hook wins in TR and EN |
| Reddit | peer advice | helpful comments only | none (participation only) | no spam, no planted comments | none; participate only as disclosed maker |

## Landing-page operating baseline

- **Primary conversion and destination:** App Store click from a localized landing page
- **Visitor intent / search topics:** hair transplant timeline, shock loss week 3, ugly duckling phase (+ TR/AR equivalents)
- **Shipped proof asset/state:** typical-phase screenshot
- **Current message / CTA:** See what's typical for your week of recovery
- **Analytics events and consent owner:** consent-gated GA4; owner is the product owner
- **Performance/accessibility baseline:** Lighthouse ≥ 90 mobile (to be measured)
- **Last reconciled with public app version:** not yet published

Working research, platform drafts, asset prompts, and the full website design brief live
under ignored `.factory/post-launch/<date>/`; only durable decisions belong here.

## Six-week launch calendar

Each week's Outcome names the MRR-ladder rung it serves.

| Week | Outcome | Actions | Evidence / stop condition |
|---|---|---|---|
| 1 | TestFlight with 20 real transplant patients (rung 1) | recruit from TR/EN communities as disclosed maker; personal replies | 20 users logged a day 0 |
| 2 | Fix top 3 drop-offs | read funnel in DebugView; fix | onboarding completion ≥ 70% |
| 3 | Submit for review | store assets in 20 locales; review notes with consent copy | approved or actionable rejection |
| 4 | Launch TR + EN organic videos | 3 videos/week from real states | profile-visit rate |
| 5 | First paywall experiment | annual pre-selected (control) vs monthly pre-selected | paywall → purchase delta |
| 6 | Decide rung 2 channel | double down on best channel | repeat profitable cycle |

## Ranked experiment backlog

Only one experiment may be active on a surface. Starting Remote Config, RevenueCat,
PPO/CPP, In-App Event, price, or paid-media changes requires explicit apply approval.
Operate Apple product-page variants through `/app-store-growth`; record version/build,
surface IDs, locales, immutable manifest, readback, and decision evidence.

| Rank | Bottleneck | Hypothesis | Primary metric | Minimum runtime/sample | Stop condition | Status | Decision evidence |
|---:|---|---|---|---|---|---|---|
| 1 | unknown until launch data | monthly pre-selected lifts paywall → purchase versus annual pre-selected (control) | paywall → purchase | 28 days / ≥ 100 paywall views | 90% confidence or 28 days | proposed | pending |

# Post-launch app operations

*Read this after the app is public, or whenever running `/operate-app`.*

The goal is to operate the product after launch: protect reliability, listen to users,
create honest distribution assets, improve the website/store funnel, and feed measured
learning back into product decisions. This is an operating loop, not a promise of virality.

## Operating order

Run these lanes in order so content never outruns product truth:

1. **Release health:** latest public version, Crashlytics crash-free users, new/fatal
   issues, provider failures, performance traces, App Review/release status.
2. **Business health:** ASC impressions/downloads, Firebase activation/retention,
   RevenueCat trial/paid/churn/refund and unit-cost guardrails.
3. **Voice of customer:** App Store reviews, support themes, cancellation reasons, and
   public category conversations. Apply the review mining method (extract → dedupe →
   rank → cite) from `docs/playbooks/product-strategy.md`; separate repeated evidence
   from anecdotes by deduplicated theme frequency, never raw mention counts.
4. **Public content research:** current X, Instagram, TikTok, and Reddit patterns,
   questions, objections, vocabulary, creative formats, and community rules.
5. **Production:** platform-native drafts, real product capture/asset prompts, landing-page
   brief, and one measurement plan.
6. **Approval/apply:** preview every external mutation; publish only the approved batch.
7. **Learn:** record post IDs/URLs, UTMs, baseline, result window, and the next decision.

If release health is red, stop promotional publishing and prioritize the incident or
misleading claim correction. Never market around a broken money path.

## Research protocol

Research must be fresh at execution time. Use public platform search, web search, store
reviews, public ad libraries, and available authenticated read-only tools. Default windows:
7 days for formats/conversations, 30 days for repeated problems, 90 days for durable
category narratives. Save source URL, observed date, platform, exact audience signal,
engagement context, and confidence. Do not treat likes/views as causal proof or copy a
creator's wording, visual identity, character, or sequence.

For each platform, collect:

| Platform | Research | Draft output |
|---|---|---|
| X / Twitter | category vocabulary, recurring questions, quote-worthy product evidence, relevant conversations; no automated reply harvesting | 3 concise posts, 1 optional 4–6 post thread, visual prompt, alt text, CTA/UTM |
| Instagram | Reels/carousel structures, save/share triggers, comment questions, visual conventions | Reel script + shot list, 6–8 panel carousel copy, caption, cover prompt, alt text, CTA/UTM |
| TikTok | first-2-second hooks, search phrases, creator-native demos, objection formats | 15–35s 9:16 script, beat-by-beat shot list, on-screen text, voiceover, safe audio direction, caption/CTA |
| Reddit | subreddit rules, recurring pain/questions, high-quality answer patterns, launch-post eligibility | helpful answer drafts and—only where rules allow—a transparent founder post with affiliation disclosed |

Reddit posts must lead with useful information and disclose the founder/app relationship.
No fake accounts, vote manipulation, mass cross-posting, unsolicited DMs, community spam,
planted/seeded comments on the app's own promotions, incentivized reviews, purchased
engagement/followers, or pretending to discover one's own product. On every platform, use
real app footage or clearly labeled illustrative media; claims must map to the shipped build.

**Channel decay (two clocks).** Every channel degrades as audiences habituate — plan for
it instead of being surprised by it. Fast clock: one creator's audience saturates on one
gotcha feature after roughly 5–10 posts; the conversion dip is the signal to introduce
feature two (then three — the headline stays the headline). Slow clock: whole tactics
decay over years as the market bids them up, so be greedy with the channel that works now
and always be testing the next one before you need it.

**Build in public (X).** A named strategy, not a side effect: post ship logs, real
revenue, failures, and lessons from the founder's own account. The larger return is the
network — bigger accounts reshare honest build logs, and that compounds. DM only people
who engaged with a post first ("do you have ten minutes? I'd love to learn from you") —
the existing no-unsolicited-DM rule stands.

Creator, meme-page, UGC, and paid-ads execution detail lives in
`docs/playbooks/distribution.md`.

## Content package contract

Default weekly package varies one hypothesis, not every variable:

- one audience tension and one content pillar;
- one real product proof clip/state;
- platform-specific hooks and copy—never identical cross-post text;
- asset brief: dimensions, duration, first frame, screen capture state, overlay text,
  captions, safe area, motion, audio direction, and thumbnail/cover;
- accessibility: burned-in captions where useful and meaningful alt text;
- relationship/sponsorship/AI-media disclosure when applicable;
- CTA with channel-specific UTM and destination;
- primary metric, guardrail, minimum observation window, and stop condition.

Use `docs/playbooks/marketing-video.md` for real-footage cuts. AI-generated artwork may
support a concept but cannot fabricate a testimonial, review, UI state, result, person,
or news event. Do not reuse copyrighted music without platform-valid rights.

## Detailed landing-page design prompt

`/operate-app` writes a complete implementation prompt to
`.factory/post-launch/<date>/landing-page-brief.md`. It must be usable by Sites, a coding
agent, Figma/Stitch, or a human designer without guessing. Fill every field:

```text
Design and build the responsive marketing website for <APP_NAME>, a <POSITIONING>.

BUSINESS GOAL
- Primary conversion: <APP_STORE_CLICK / WAITLIST / DOWNLOAD>
- Target audience and trigger: <ICP + MOMENT>
- One-sentence promise: <PROMISE>
- Differentiator and proof: <WEDGE + SHIPPED EVIDENCE>
- Primary channel/visitor intent: <CHANNEL + SEARCH/SOCIAL INTENT>

BRAND & VISUAL DIRECTION
- Personality: <3 ADJECTIVES>; avoid <GENERIC/CATEGORY CLICHES>
- Existing app tokens: <COLOR ROLES, TYPE SCALE, SPACING, RADII, MOTION>
- Art direction: <REAL SCREEN CAPTURE / PRODUCT PHOTOGRAPHY / ILLUSTRATION>
- Use authentic shipped UI. Do not invent screens, testimonials, ratings, awards, or metrics.
- Use strong typography/layout before decorative imagery; no model-authored SVG art.

PAGE ARCHITECTURE
1. Header: mark, concise nav, primary App Store CTA.
2. Hero: outcome-led H1, one clarifying sentence, CTA, official badge, real hero proof.
3. Problem → outcome: the user's triggering moment and observable transformation.
4. How it works: exactly 3 steps with real app states.
5. Core proof: interactive/demo video or before-after supported by shipped behavior.
6. Benefits: 3–5 outcome cards; distinguish benefits from implementation features.
7. Trust: privacy/data handling, support route, honest social proof if verified.
8. Pricing: current offering summary without hardcoding stale storefront prices; link terms.
9. FAQ: objections from current reviews/social research, cancellation/privacy/support answers.
10. Final CTA and footer: support, privacy, terms, press/contact, official store badge.

INTERACTION & RESPONSIVE BEHAVIOR
- Mobile-first 320px upward; define hero stacking, navigation collapse, media aspect ratios,
  tap targets, reduced-motion behavior, loading/error/fallback states, and keyboard focus.
- Motion is restrained and purposeful; never delay CTA access or autoplay audio.
- Preserve hierarchy at large Dynamic Type/browser zoom and localization expansion.

QUALITY & COMPLIANCE
- WCAG 2.2 AA, semantic landmarks/headings, visible focus, alt text, captions, contrast.
- LCP <=2.5s, CLS <=0.1, INP <=200ms target on representative mobile hardware.
- Responsive images, lazy-load below fold, no blocking third-party scripts.
- Privacy/consent matches actual analytics; no dark patterns or pre-checked marketing consent.
- Apple badge/link usage follows current marketing guidelines.

SEO, SOCIAL & MEASUREMENT
- Search intent and primary/secondary topics: <TOPICS>; write natural product-specific copy.
- Unique title/meta description, canonical, Open Graph/X metadata, app deep link, robots/sitemap,
  Organization/SoftwareApplication structured data only when facts are verified.
- Generate one 1200x630 social-card brief matching the final site; validate all rendered text.
- Events: landing_view, hero_cta_click, store_badge_click, demo_play, faq_open.
- UTM convention: utm_source=<platform>&utm_medium=organic_social&utm_campaign=<campaign>&utm_content=<creative_id>.

DELIVERABLES
- Production page(s), token mapping, final copy, real asset manifest, analytics map,
  accessibility notes, responsive QA matrix, performance evidence, and deployment/readback plan.
```

The app's existing hosted Vite site remains the default project surface. A replacement
framework or host needs a documented decision. If a Sites-compatible project exists,
follow its site-building/hosting workflow; otherwise preserve the current package manager,
Firebase Hosting, analytics consent, and legal routes.

## Approval and publishing boundary

Research and local drafts are automatic. The following need a concise preview and
explicit approval for the exact target/account/batch: publishing or scheduling posts, replying or
DMing, changing bios/links, uploading media, editing the live website, changing store
metadata, sending notifications/email, starting an experiment, or spending money.

Approval is single-use for the shown batch. Read back the public URL/post ID and visible
content after applying. If a connector is unavailable, return a copy-ready package and
manual checklist; never ask for passwords/cookies in chat or automate around 2FA.

## Artifacts and canonical memory

Write working artifacts under ignored `.factory/post-launch/<YYYY-MM-DD>/`:

```text
research.md
content-calendar.md
drafts/x.md
drafts/instagram.md
drafts/tiktok.md
drafts/reddit.md
asset-shot-list.md
landing-page-brief.md
measurement-plan.md
publish-readback.md
```

Durable truths stay in PRODUCT.md and `docs/growth-plan.md`; experiment decisions/results
go to `docs/decisions.md`; product requests go to `docs/backlog.md`. Never commit scraped
content, private analytics exports, user handles, raw reviews containing PII, or credentials.

## Cadence

- **Daily (automatable read-only):** crash/provider/revenue anomaly summary and support urgency.
- **Weekly:** full research + content package + funnel diagnosis + one experiment proposal.
- **Monthly:** positioning/landing/store consistency, creative winners, cohort retention,
  unit economics, content pillar pruning, and roadmap evidence.
- **Per release:** update site/store truth, screenshots/demo, release notes, FAQs, support
  macros, privacy inventory, and reusable content captures.

When the harness supports recurring automations, the operator may approve a daily
read-only health/listening run, a weekly local-draft content run, and a monthly strategy/
site audit. Show the timezone and recurrence before creation. Recurring runs never publish,
reply, DM, deploy, start experiments, notify users, or spend; those always remain previewed
single-use approvals in the active task.

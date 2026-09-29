---
description: Operate a published app across health, reviews, social content, website, and measured growth
argument-hint: [--cadence=daily|weekly|monthly|release] [--mode=plan|draft|publish] [--platforms=x,instagram,tiktok,reddit,web] [--schedule=none|daily|weekly|full]
---

Operate the published app for: **$ARGUMENTS**

Set `python3 scripts/factoryctl.py run stage post_launch`, then refresh recommendations.
This lifecycle marker never authorizes publishing, deployment, scheduling, replies, or
spend.

Read `docs/playbooks/post-launch.md`, `docs/playbooks/growth-loop.md`,
`docs/playbooks/marketing-video.md`, `docs/growth-plan.md`, PRODUCT.md,
`docs/playbooks/analytics.md`, and recent `docs/decisions.md` rows. For creator,
meme-page, UGC, or paid-ads work read `docs/playbooks/distribution.md`.

## Invocation

- Defaults: `--cadence=weekly --mode=draft --platforms=x,instagram,tiktok,reddit,web --schedule=none`.
- Accept only the documented cadence/mode/platform values; reject duplicates and unknowns.
- `plan` performs research and creates briefs; `draft` also creates copy-ready content;
  `publish` still requires a fresh exact-batch approval before any external mutation.
- Create `.factory/post-launch/<YYYY-MM-DD>/`; keep provider exports and working evidence
  ignored, aggregate, redacted, and free of credentials/PII.
- With a non-`none` schedule, show the local timezone, exact recurrence, mode and platforms
  and obtain approval before creating/updating a harness automation. Scheduled runs are
  read-only health or local drafts only; they can never use publish mode.

## Workflow

1. **Health first.** Read latest public build/release status and aggregate Crashlytics,
   Firebase, RevenueCat, ASC and provider health through available authenticated tools.
   If unavailable, request only the documented safe export. A severe crash, purchase,
   privacy, review, or provider issue blocks promotional publishing and produces the
   incident/recovery next action.
2. **Listen.** Read current App Store reviews, support/cancellation themes, and public
   category conversations. Record repeated themes, evidence strength, affected version,
   and candidate backlog items; never copy usernames or raw PII into durable docs.
3. **Research fresh public evidence** for each selected social platform using the 7/30/90
   day windows and platform-specific contract in `docs/playbooks/post-launch.md`. Capture
   source URLs and dates. Check Reddit community rules before drafting any promotional post.
4. **Choose one weekly content hypothesis** based on the product's primary channel,
   current bottleneck, audience vocabulary, and a real shipped proof state. Do not chase a
   trend that conflicts with brand, product truth, safety, or the active growth experiment.
5. **Produce native drafts.** Write every selected platform deliverable plus
   `asset-shot-list.md`: X posts/thread; Instagram Reel/carousel/caption; TikTok 9:16
   script/shot list/on-screen text; Reddit helpful answer and only rule-permitted disclosed
   founder post. Include accessibility, disclosure, CTA/UTM, metric and stop condition.
6. **Website.** Create the fully filled detailed prompt from the post-launch playbook in
   `landing-page-brief.md`, reconciling app design tokens, current shipped screens, store
   metadata, pricing, legal/privacy, SEO, social card, analytics, performance and
   accessibility. In plan/draft mode do not modify the live site. In publish mode, show
   the proposed site diff/preview and exact hosting target before approval.
7. **Measure.** Run the growth diagnostic when funnel inputs are sufficient. Create one
   `measurement-plan.md` connecting creative IDs/UTMs to the primary metric and guardrail.
   Update `docs/growth-plan.md` only with durable hypotheses/cadence decisions; append
   approved experiment/result decisions to `docs/decisions.md`; route product requests
   to `docs/backlog.md`.
8. **Approval/apply.** Present a compact manifest of exact accounts, posts/media, schedule,
   site diff, and remote actions. Ask for explicit approval once for that immutable batch.
   Publish through authenticated connectors/browser tools only after approval. Never ask
   for passwords, cookies, recovery codes, or API keys in chat; login/2FA remains human.
9. **Readback.** Verify public post/site URLs and visible content, save IDs/URLs and
   timestamps to `publish-readback.md`, and name the next measurement date. Stop on any
   mismatch; do not blindly repost.
10. **Recurring operation (optional).** Through the harness's supported automation
    mechanism, `daily` schedules health/listening in plan mode, `weekly` schedules the
    research/content package in draft mode, and `full` adds a monthly strategy/site audit.
    Never edit raw automation files or schedule publishing, replies, DMs, site deploys,
    experiments, notifications, or spend.

Never fabricate users, testimonials, ratings, results, screenshots, conversations, or
social proof; post planted/seeded comments on the app's own promotions; run
incentivized reviews; buy purchased engagement/followers; spam communities; manipulate
engagement; send unsolicited DMs; auto-reply at scale; use unlicensed media; or spend
on ads. Missing data remains `unknown`.

When a plan or draft package passes its local acceptance checks, run
`python3 scripts/factoryctl.py recommend done operate-app`. Then run
`python3 scripts/factoryctl.py recommend refresh` and
`python3 scripts/factoryctl.py recommend list`. Append at most three next recommendations
with why/role/risk/delegation, up to ten TODOs, and pending human approvals. Health or
release blockers suppress promotional suggestions.

Output:

```text
POST-LAUNCH REPORT — <app> · <cadence> · <date>
Release/business health: …
Customer/review signals: …
Research sources and confidence: …
Content hypothesis + selected proof: …
Draft package: X / Instagram / TikTok / Reddit / web paths
Measurement: metric, guardrail, window, stop condition
External approval: none | exact immutable batch
Next measurement/action: …
```

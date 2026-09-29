# Onboarding

*Read this when: building or changing any onboarding screen. Onboarding → paywall is the money path — it gets design, performance, and analytics priority over everything else.*

## Principles (the lens for this flow)

- **Increase Value:** get to the "aha" moment fast — the earliest point where felt value predicts retention (Reforge's Setup → Aha → Habit framework).
- **Reduce Cognitive Friction:** chunk into steps with visible, even pre-filled progress (the "endowed progress effect" — start the bar at ~20%, not 0%, measurably lifts completion); taps over free text; graphics over paragraphs.
- **Create a Mental Model:** set an honest expectation for how the app fits their life/routine — show the estimate and how you arrived at it; never overpromise, that costs trust.

These 3 principles collapse into ~3–4 conceptual phases — capture goal → build commitment → deliver the "aha" moment → paywall. The table below is the tactical decomposition of those phases into 5–9 concrete screens; "a few steps" and "5–9 screens" describe the same flow at two altitudes, not a contradiction.

## Canonical flow (5–9 screens, 60–90 seconds total)

| # | Screen | Purpose & rules |
|---|---|---|
| 1 | Welcome hook | One promise, one CTA, zero text walls. Fires `onboarding_start`. Start prefetching RevenueCat offerings HERE so the paywall renders instantly later. Illustration can be AI-generated once at dev time — see `docs/playbooks/design.md` Inspiration workflow. |
| 2 | Value demonstration | Show the "after" state or run a live mini-demo of the core magic. AI apps: generate a real sample instantly — BEFORE any signup or paywall. The user must feel the wow. |
| 3–5 | Personalization questions | 3–6 single-tap questions with progress pre-filled to ~20% (endowed progress effect), never free-text. **Only include this phase if personalization/education/emotional connection is genuinely needed** — RevenueCat's own guidance warns a quiz added without a real reason just adds friction, it isn't a default box to tick. |
| 6 | Synthesis screen | "Preparing your plan…" with animated checkmarks referencing their answers. Commits the user; measurably lifts paywall conversion. Optionally show one testimonial/rating matched to the user's stated goal here (not a generic one) — matched social proof measurably outperforms generic stars. |
| 7 | Permission priming | Custom explainer screen BEFORE the system dialog. Notifications only by default (ATT only if actually tracking — see `docs/checklists/security.md`). Never stack two system dialogs. If declined, don't re-ask — deep-link to Settings later at a moment of need. |
| 8 | Paywall | Full-screen, end of onboarding, before home. Headline echoes the user's stated goal from personalization ("Your plan for better sleep is ready"). See `docs/playbooks/paywall.md`. |

## Payoff placement: demonstrate vs. tease

Two legitimate patterns exist and they pull in opposite directions — state which one the
app uses (PRODUCT.md / `docs/decisions.md`) so the flow doesn't flip-flop between them:

- **Default (kit doctrine, unchanged):** deliver a real value sample BEFORE any signup
  or paywall (screen 2 above). The user feels the wow, then meets the paywall.
- **Compliant tease-then-gate variant:** the personalized analysis/result is genuinely
  computed during onboarding and truthfully previewed (a real preview, a real progress
  state), with the full result unlocked by the paywall. Allowed only if the preview is
  real — no fake progress bars, no invented numbers, no implying a result that doesn't
  exist — and the paywall discloses terms per `docs/playbooks/paywall.md`. This converts
  because the user wants a specific answer that exists; it becomes a dark pattern the
  moment the answer doesn't.

## Hard rules

- **Anonymous Firebase auth happens silently during onboarding** (`docs/playbooks/firebase.md`) — the user gets a stable UID before the paywall; `Purchases.logIn(uid)` before any purchase. No signup wall, ever (also an App Review 5.1.1 risk).
- **Offline-tolerant:** never block a step on network. Personalization answers cache locally and sync later.
- **Back navigation is allowed** on personalization questions (people change their mind) — but never let anyone skip past the paywall screen itself; permission priming is the only step that may be skipped/deferred.
- **Every screen fires `onboarding_step_<n>`** with the step name as a param; flow ends with `onboarding_complete`. Completion target ≥70%.
- **Zero jank:** 60fps transitions, no layout shift, no spinners between steps. See `docs/checklists/performance.md`.
- Copy is localized from day one (i18n keys — `docs/playbooks/localization.md`).
- Onboarding variant name goes into the `onboarding_variant` user property (Remote Config `onboarding_variant`) so funnels are comparable across experiments.

## Why this shape (evidence)

- RevenueCat's State of Subscription Apps (2026, 115k apps): the subscriber is won or lost in the first session — 82% of trial starts happen on Day 0, and 55% of 3-day-trial cancellations happen on day 0 too. The "aha" must land before the paywall.
- Hard paywalls at the end of a value-building onboarding convert ~5× freemium (10.7–12.1% vs 2.1–2.2% install→paid median across RevenueCat/Adapty benchmarks).
- Personalization → synthesis → tailored paywall headline is the standard pattern in top-grossing consumer apps because stated goals make the pitch specific — this is the practical form of the Setup → Aha → Habit activation framework.

## Anti-patterns

- Signup/login wall before value demonstration.
- **Length is a default budget, not a universal ceiling:** 90s / 9 screens is right for utility/AI-tool apps. Health/coaching/education categories can run a much longer quiz — Noom's runs 100+ screens and still converts well — **because every extra screen adds real personalization**, not because long onboarding is inherently fine. Never add a screen that only collects demographics without visibly personalizing what comes next.
- Free-text inputs; skippable-but-hidden progress.
- Asking permissions without priming, or two system dialogs back-to-back.
- Paywall buried in settings instead of at onboarding end.
- Dark-pattern dismissal tricks (invisible X, fake countdowns) — review rejection + refund magnet.
- **Rate-app screen inside onboarding (before or after the paywall) — explicitly rejected even though growth guides recommend it:** violates the kit trigger policy and guideline-compliant prompting in `docs/playbooks/store-listing.md` (no sentiment pre-filtering, never during onboarding, 3 prompts/365 days).

## Out of scope by default: no-code remote flow builders

No-code vendors that let a non-technical person edit native onboarding/survey/permission screens remotely without an app-store review exist and are a real category (Adapty's onboarding builder is the most established; small newer entrants like "Setgreet" exist too but showed no funding, HN/PH launch, or community traction on inspection — a bigger vendor-risk bet for a money-critical surface). The kit doesn't default to any of them: app-factory's whole premise is that **Claude writes the native code directly**, faster and more precise than a drag-and-drop builder for a solo developer; Firebase Remote Config + A/B Testing (`docs/playbooks/firebase.md`) already covers copy/variant iteration without app review, compliantly (Apple's rule is "remote changes to data, not code" — text/color/image swaps and toggling pre-built variants are fine; only genuinely new structural layouts need a vendor). These vendors bill on MAU — exactly the metric this kit is trying to grow, so success means a fast-rising bill for a capability already covered for free, plus a new SDK requiring its own `PrivacyInfo.xcprivacy` declaration. Reconsider only if a project adds a non-technical teammate who needs to self-serve screen edits without going through code.

## Automation split

| Claude automates | Human does |
|---|---|
| Full flow implementation, personalization question bank from PRODUCT.md, event wiring, priming copy, localization, Remote Config variant plumbing, dev-time illustration generation (`scripts/generate-illustrations.sh`) | Approves question set + tone; approves permission timing; reviews the wow-moment demo quality on device; provides their own OpenAI key if using AI-generated illustrations |

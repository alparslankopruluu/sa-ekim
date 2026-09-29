# Store Listing / ASO

*Read this when: preparing store assets, metadata, or any App Store Connect listing work.*

The canonical Apple growth/asset truth contract is `docs/playbooks/app-store-growth.md`.

## Screenshots

Final screenshot creative starts only after M1/M2 acceptance and a stable M3
release-candidate. Earlier calls become an `after_milestone` TODO; they do not scaffold,
capture, render, invoke AI, or upload. The store-assets skill bundles a pinned complete
HyperShots runtime for iOS HTML/CSS authoring, exact profiles, auto-fit, translation,
rendering, validation, protected grading, and review galleries. Use its real-capture
contract and nine launch-locale Noto/RTL extension; never install a floating upstream copy.
Android retains its native screenshot pipeline because the pinned upstream has no Play
renderer.

The first two screenshots carry the strongest distinct user benefits; the third proves
the real core flow. Each hook must map to PRODUCT.md's approved three-second demo/video-
ready state and to a shipped feature in the exact uploaded build. Do not optimize a
caption around an outcome the UI cannot visibly prove.

- Required set: iPhone 6.9" — **1320×2868** px portrait (1290×2796 and 1260×2736 also accepted). One set per device family; smaller devices auto-scale.
- iPad 13" — **2064×2752** px (2048×2732 accepted) — ONLY if the app ships iPad support. Rule: don't ship iPad unless the layout is genuinely adapted; a weak iPad UI costs reviews and review time.
- 1–10 screenshots, PNG/JPEG, no alpha.
- **The first 3 portrait screenshots show in search results — they are the ad unit.** Treat #1 as the hook.
- Design rules:
  - Caption-led: 5–8 word benefit headline per panel, device frame below. Must be readable at ~200px thumbnail width — test it.
  - Narrative: #1 core value promise + hero UI → #2–3 top outcomes/features → #4+ social proof, personalization, breadth.
  - Real UI only (Apple rejects misrepresentation). No prices/discounts, URLs, other-platform marks, Apple awards, unverifiable claims, real-person data, or content unsuitable for ages 4+. Localized captions per storefront always; localized UI shots once the UI is localized.
  - Connected panoramas OK, but each frame must stand alone in search.

### Screenshot copywriting doctrine

- Roughly **70% of screenshot effectiveness is the text overlay, not the UI**; a pure copy
  rewrite has driven large conversion lifts. This is an ASO-practitioner claim, not a
  kit-measured fact — treat it as directional and verify against your own PPO results.
- **The cover-the-UI test:** hide the UI, read only the headlines. Do they tell a story, or
  list features? A feature label answers "what does it do", not "is this for me". If the
  caption would fit any app, it is a label, not copy.
- **Sequence that converts** — each panel does ONE job, one message:
  - #1 name the pain
  - #2 state the shift
  - #3 show proof (real numbers only)
  - #4–5 feature delivery — the capability that delivers the #2 promise
- If you cannot state the change in ~8 words, you do not understand it yet. Rewrite until you
  can; the headline comes before panel design, not after.
- **Outcome over implementation** — sell the after-state, not the feature:
  - `Dark mode support` → `see everything that matters, at a glance`
  - `workout tracking` → `you'll never forget what you lifted`
  - `Notes → Slides. Instantly.` → `Stop designing slides. Write notes. Start presenting.`
- Your UI is evidence; your text is the argument. Write the headline before designing the panel.
- Test at ~200px thumbnail width (the same bar as the design rules above) and write localized
  captions per storefront — never ship a translated default.
- Truthfulness still binds: real UI only, no invented numbers, no unverifiable claims. The
  doctrine changes the copy, never the evidence contract above or in
  `docs/playbooks/app-store-growth.md`.

## Metadata fields (ranking weight: name > subtitle > keywords)

For professional multi-market rewriting, locale resolution, calibration, platform-specific
limits, release-note behavior, and the canonical review ledger, read
`.agents/skills/source-command-store-assets/references/metadata-localization.md`. The exact
project target matrix—not an assumed default language set—is the completion boundary.

| Field | Limit | Rules |
|---|---|---|
| App name | 30 | Title order depends on distribution: **ASO/SEO-led → `Generic keyword phrase + Brand`** (brand LAST — autocomplete + indexing favor the generic lead); **UGC/Ads-led → `Brand + Generic`** (win #1 for the branded term people search after seeing your ad). Never repeat words across name/subtitle/keywords |
| Subtitle | 30 | Next-best keyword phrase as a benefit; NEVER repeat words from name |
| Keyword field | 100 | comma-separated, no spaces after commas, no singular+plural dupes, no words already in name/subtitle, no "app/free/best", no competitor brands. Apple indexes cross-field word combinations — optimize word coverage, not phrases |
| Description | 4000 | NOT ranked on iOS — pure conversion. First 2–3 lines (before "more"): outcome + social proof. Then feature bullets → subscription terms (required) → support/privacy links |
| Promotional text | 170 | Editable WITHOUT review — seasonal hooks, launch offers, announcements |

- Also indexed: in-app purchase display names.
- Not ranking factors: description, promo text, update frequency (directly).
- Category: pick the least competitive plausible primary.
- Maintain a **keyword matrix per locale** (keyword | est. volume | difficulty | current rank) in this file's project section; refresh every release.

## Trademark & marketing usage

- Never use Apple trademarks (iPhone, iOS, App Store, Apple) in the app name, subtitle, or keyword field.
- If copy/screenshots reference "iPhone": use "for iPhone" / "compatible with" phrasing, real device photography only (no renders), never Apple's logo, no implied endorsement.
- Any external marketing (landing page, social post) linking to the App Store uses the **unmodified official badge** artwork at ≥40px on-screen height with quarter-height clear space — no animation, 3D, recoloring, or pairing with a competitor's badge.

*Source: Apple's IP guidelines for 3rd parties; App Store Marketing Guidelines.*

### Delivery convention

Canonical metadata lives under the schema generated by `asc metadata init --dir ./metadata`; never hand-invent a parallel format. HyperShots authoring sources live in `.shots/`, real captures in `screenshots/raw/ios/<profile>/<locale>/`, and approved final screenshots in `screenshots/review/<locale>/`. Generated `.shots/out`, profile CSS, locale panel copies, and logs stay ignored. `/store-assets` validates both, previews metadata with `asc metadata apply --dry-run`, plans screenshots with `asc screenshots plan`, and uploads through `asc` after blueprint or explicit approval. Fastlane remains only a SwiftUI capture fallback, never the iOS upload authority.

## App preview videos

- Only AFTER screenshots are optimized — a preview replaces a screenshot slot in search; a mediocre video lowers conversion.
- Worth it when the app demos well in motion (AI generation, transformations). Specs: 15–30s, up to 3 per size, autoplays muted (must work silent), predominantly real captured footage, poster frame chosen deliberately.
- Producing the preview + social promo cuts: `docs/playbooks/marketing-video.md`.

## Growth surfaces (free discovery — use them)

- **In-App Events:** up to 15 approved / 10 published at a time; event ≤31 days, promotable 14 days ahead. Use quarterly for content drops, challenges, seasonal pushes.
- **Custom Product Pages:** up to **70** per app; own screenshots/promo text and, on iOS 18+, a matching deep link. CPPs may be discovered through assigned App Store search keywords as well as URL and Apple Ads. One distinct audience intent/keyword/creative per page; each gets page-level activation analytics.
- **Product Page Optimization (PPO):** Ready for Distribution only; native A/B for icon/screenshots/previews; ≤3 treatments vs control; icon variants must ship in the binary. One variable per test with a predeclared sample, duration, and stop condition. Use `/app-store-growth` for plan/prepare/apply/measure.

## Ratings & review prompts

- API — **SwiftUI:** `@Environment(\.requestReview)` / `AppStore.requestReview`. **Expo RN:** `expo-store-review` → `StoreReview.requestReview()`.
- System cap: 3 prompts / 365 days / user — silent no-ops beyond that. Spend them well.
- Kit trigger policy: prompt only when ALL hold — (a) moment of value just happened (core action completed ≥2 times, or result saved/shared), (b) ≥3 days since install, (c) no crash or failed purchase this session. Gate behind a Remote Config kill switch (`ff_review_prompt`).
- NO sentiment pre-filtering (asking "enjoying the app?" and only routing happy users to the prompt violates guidelines).
- **Never prompt during onboarding** — the user hasn't felt value yet, and it wastes one of the 3 yearly prompts. Reserve it for a post-paywall positive moment in the main flow.
- Respond to negative reviews in ASC (public, affects conversion): Claude drafts, human sends.

## ASO launch tip

- At launch, a small Apple Search Ads budget speeds initial keyword indexing — set search match OFF and use Advanced campaigns. [verify current ASA behavior]

## Automation split

| Claude automates | Human does |
|---|---|
| Metadata drafts all locales; keyword matrix + 100-byte packing; asc canonical metadata; shot-list, capture, framing, validation, dry-run and approved upload; review-response drafts; release notes | ASC login/2FA when needed; blueprint/final creative approval; App Store review submission; PPO start/stop; Apple Search Ads spend; sending review responses |

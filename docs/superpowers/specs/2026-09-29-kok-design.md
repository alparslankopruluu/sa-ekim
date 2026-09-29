# Kök — design spec (2026-09-29)

Approved by the product owner on 2026-09-29 with these changes to the proposal: name **Kök**,
global launch in **20 languages** (Türkiye first, then Arab world and USA), build order
**A → B → C**, **no free trial**, weekly $7.99 / monthly $12.99 / annual $39.99, credit packs
on top. Everything else was delegated. `PRODUCT.md` owns what/why; this file owns *how*.

## 1. Phases

- **A — App + mock backend.** Every screen, every animation, the whole money path, all 20
  languages, runnable on iOS/Android/web with `EXPO_PUBLIC_BACKEND_MODE=mock` and no keys.
- **B — Functions + fal.** `functions/` implements the same callables with real credits,
  idempotency, refunds, a fal image-edit provider, RevenueCat webhook, wheel, cohort. Tested
  with node:test and the Firebase emulator rules tests; **not deployed** by the agent.
- **C — Store setup.** RevenueCat + App Store Connect + Play catalog, Firebase projects,
  screenshots, listings. Needs the owner's accounts: prepared as scripts/docs, applied only
  with the owner's approval.

## 2. Route and file map (owners)

Routes are fixed by `src/app/_layout.tsx` (root stack) and `src/app/(tabs)/_layout.tsx`.

| Route | Screen | Owner |
|---|---|---|
| `index` | gate → onboarding or tabs (exists) | lead |
| `onboarding` | 8-step onboarding, ends at paywall | **money** |
| `(tabs)/index` | Today | **journey** |
| `(tabs)/journey` | timeline, phase card, photo grid, sessions | **journey** |
| `(tabs)/previews` | saved previews + "new preview" | **preview** |
| `(tabs)/settings` | prefs, language, data, legal, developer | **money** |
| `capture` | camera with ghost overlay + upright gate | **journey** |
| `compare` | wipe / side-by-side compare (Pro) | **journey** |
| `shed` | shed log sheet + chart | **journey** |
| `journey-setup` | operation date, kind, clinic (modal) | **journey** |
| `photo/[id]` | photo detail, delete | **journey** |
| `guide/[phase]` | phase guide page | **journey** |
| `preview/index` `rendering` `result` | style picker → progress → result wipe | **preview** |
| `paywall`, `gift`, `credits` | money path | **money** |
| `consent`, `report`, `legal/[doc]`, `developer`, `update` | support screens | **money** |

Layers (owners): `src/services/backend/**`, `services/session.ts`, `notifications.ts`,
`purchases/**`, `rewards.ts`, `review.ts`, `remoteDefaults.ts` → **backend-app**; `functions/**`,
`firestore.rules`, `storage.rules`, `firestore-tests/**`, `docs/data-model.md` →
**functions**; `src/features/<feature>` and the routes above → their owner. Shared UI
components (`src/components`) may be **extended** by anyone but never forked; a new shared
component goes in `src/components`. Do not edit another owner's files — ask the lead.

## 3. Design language

Tokens in `src/theme/tokens.ts` ("Warm Clinic Noir"): espresso surfaces, copper primary, sage
for growth/on-track, gold highlight. DM Serif Display for display/title, system font for
body. Dark only. **Reused from Belto (already in `src/components`)**: `Button` (shine, glow,
loading), `PressableScale` (spring press + haptic), `Confetti`, `AnimatedNumber`, `ProgressRing`,
`StageBackground`, `StepProgress` (endowed progress), `GlassCard`, `OptionCard`, `Chip`,
`SegmentedTabs`, `Toast`, `ui.tsx` (Skeleton, ErrorState, CloseButton…), `CreditPill`,
`features/gift/GiftWheel`, `features/paywall/PlanCard`. Motion tokens in `src/theme/motion.ts`.
Rules: UI-thread Reanimated worklets only; every animation respects `useReducedMotion`;
haptics only at the causal moment; no countdown timers or fake urgency (App Review 5.6 and
3.1.2 — the only dates shown are real expiry dates). New visual pieces to build: before/after
**wipe** slider, **ghost camera**, **phase band chart** (SVG, no axis numbers), shed bar chart,
phase timeline rail, day/week hero ring, cohort card.

## 4. Journey (owner: journey)

Data: `useJourney` (persisted) + `useSession.goal/stage` + `@shared/timeline` pure functions.
Photos are files under `documentDirectory/journey/<id>.jpg` written by
`services/journeyFiles.ts` (expo-file-system new API); never uploaded by the journey code.

- **Today**: greeting by day part; hero ring = maturation progress with "Day N · Week W";
  phase card (title, "what is normal", next-phase countdown as *days*, not a timer); next task
  (photo due per `isPhotoDue`, first-14-days care checklist, shed log nudge in weeks 2–8);
  compact band chart with a "you are here" dot (Pro sees full, free sees blurred band +
  lock); preview entry card; gift card (`GiftHomeCard`); empty state before day 0 is set
  ("Set your operation date"). Before the date: shows a countdown in *days to operation*
  when the date is in the future, and pre-op guidance.
- **Journey tab**: SegmentedTabs `Timeline | Photos | Sessions` (Sessions only for PRP kind,
  or shown for everyone as a "PRP course" card for `part` goal). Timeline rail = all phases
  with dates, current highlighted, anxious phases tagged "expected" not "warning". Photos =
  FlashList grid grouped by week with angle chips; free limit `FREE_LIMITS.journeyPhotos`
  (paywall `locked_photos` on the 4th photo); tap → `photo/[id]`; two-photo select → compare.
- **Capture**: `expo-camera` CameraView (front, later back for crown/top). Ghost overlay = the
  most recent photo of the same angle at 0.35 opacity + oval/guide lines; angle picker from
  `ANGLES_BY_GOAL`; **upright gate**: `expo-sensors` accelerometer, allow capture only when
  the phone is within ±7° of vertical (front/left/right) or flat within ±10° (top/crown);
  the shutter shows a level indicator (green/sage when OK). Gate is deterministic, never
  claims to detect face or light. Permission denied → library picker fallback
  (`capture_gate_blocked`). After capture: preview screen with Retake / Use; saves via
  `journeyFiles`, `useJourney.addPhoto`, `useSession.recordPhotoLogged`, analytics
  `photo_captured`, then reschedules reminders. Review prompt after 3rd photo.
- **Compare (Pro)**: wipe slider (Reanimated gesture) and side-by-side with week labels;
  Share as image (`expo-sharing` + `expo-image-manipulator`/view capture) with small Kök mark.
  Free users see the screen with the second photo blurred and a paywall CTA
  (`locked_compare`).
- **Shed log**: numeric quick entry (`parseShedCount`), today's value editable, 30-day bar
  chart (SVG), copy: "Shedding in weeks 2–8 is expected" (never "you are fine/sick").
  Free.
- **Guide**: 7 phases from `PHASES`; each page: what happens, what is normal, do this week
  (3–5 bullets), when to call your clinic (generic red flags: fever, spreading redness, pus,
  severe pain, heavy bleeding — "contact your clinic or a doctor"), care day-by-day for
  `care`. Pages for `care` days 0–14 are free; later phases Pro (`locked_guide`) — but the
  *title and "what is normal" sentence stay visible* (trust). Content is education from
  general clinic timelines, worded as "typically", never a promise.
- **Cohort card (Pro)**: opt-in switch → `joinCohort` (date, goal, kind only); shows
  "You are one of N people in your week" only when `sameWeek >= COHORT_MIN_VISIBLE`,
  otherwise an invitation text with no number. Mock backend returns configurable counts
  (developer screen toggle) — the number is never fabricated in live mode.
- **PRP kind**: `journey-setup` lets the user pick "PRP / mesotherapy course"; sessions from
  `PRP_DEFAULTS` (3 sessions, 4 weeks apart, maintenance 6 months) editable; each session
  toggles done; a photo before each session prompts the capture; reminders 1 day before.
- **Clinic report (Pro)**: `expo-print` PDF with first/last photo per angle, week labels,
  shed summary; shared via `expo-sharing`. No medical conclusions in the PDF.
- **Notifications** (local, `notifications.ts` API from backend-app): `scheduleJourneyReminders`
  builds: daily care reminder days 1–14 at 20:00, phase-start notifications at 09:00 for
  each phase start day, weekly photo reminder (Sunday 18:00) for 90 days then monthly, shed
  nudge every 3rd day during days 15–56, PRP session reminders. All cancelled/rebuilt when
  the date, prefs or locale change; bodies are translated strings and never medical claims.

## 5. Preview (owner: preview)

Flow: `previews` tab / Today card / onboarding → `preview/index` (goal region tabs from
`GOALS`, style cards from `stylesForGoal`, density chips filtered by style, quality toggle
Standard (1 credit) / High (3 credits), price line from `previewCost`, "free preview" state
for the onboarding preview, free-high token switch when `wallet.freeHighTokens > 0`) →
consent gate (`/consent`) → photo (camera via the capture component in `single` mode with
`regionHint` from the guide, library, or sample) → upload (`uploadPhoto`) → `createPreview`
→ `preview/rendering` (progress ring from `PreviewDoc.progress`, cancel, honest "usually
under a minute", failure with retry + automatic-refund copy) → `preview/result` (before/after
**wipe**, "AI preview — not a prediction" label always visible, Save to library, Share,
Report, Delete; watermark on free; upsell "See it in HD / all styles" → paywall
`result_upgrade`; Pro/credits unlock HD). Saved previews grid in the tab (FlashList),
empty state, in-flight badge. Sample photos: 3 bundled royalty-free-safe generated
illustrations are NOT available; use a neutral silhouette placeholder asset and the library
picker — the mock backend returns the user's own photo with a tint so the flow is demoable.

## 6. Money path (owner: money)

- **Onboarding** (`StepProgress`, endowed): 1 `welcome` (promise + demo wipe) → 2 `goal`
  (`GOALS` cards) → 3 `stage` (`STAGES`) → 4 `date` (if `done`/`planned`: date picker,
  skip allowed; calls `useJourney.setProcedureDate`) → 5 `photo` (guide + capture/library/
  skip; skip goes to paywall with no preview) → 6 `consent` (`AIConsentCard`, names AI
  providers, decline = skip preview) → 7 `notify` (priming: benefit-led, then the system
  dialog; skip allowed; `scheduleJourneyReminders` after grant) → 8 `crafting` (real
  preview render; shows real progress) → `reveal` (watermarked wipe + confetti) → paywall.
  Steps: 8 numbered (welcome … crafting) followed by the reveal and the paywall. Variant flag `onboarding_variant` from Remote Config.
- **Paywall**: three `PlanCard`s (annual pre-selected with "Best value" and per-week price,
  monthly, weekly), **no trial anywhere**, CTA "Continue" (shine), billed-price-first
  layout, savings % from store prices, Restore/Terms/Privacy row, subscription disclosure
  next to the CTA, delayed close button (Remote Config `paywall_close_delay_ms`, default
  2500, onboarding source only), failed/empty/loading states (Belto's resilience contract),
  benefits list keyed to the source (`locked_compare` → compare copy…), confetti on success,
  credits shortcut. `gift_discount` offering shows the annual intro price with a "Your gift"
  banner. The exit sequence: close → (if wheel placement `onboarding_exit` and no gift) wheel.
- **Gating matrix** (`useEntitlement().isPro`): free = care guide days 0–14, shed log, 3
  photos, 1 free preview, all preview styles at standard quality *by paying credits*;
  Pro = unlimited photos, compare, band, full guide, cohort, report, phase & photo reminders
  (care reminders stay free), HD without watermark uses credits or allowance.
  Centralize as `src/lib/entitlements.ts` (`canUse(feature)` → `{allowed, paywallSource}`) with
  unit tests; screens must not hardcode checks.
- **Gift wheel** (server-rolled, one spin/account, 3-day expiry shown as a date, one local
  reminder): `PRIZES` from `@shared/wheel` (credits10, credits5, freeHigh, discount40).
- **Credits store**: 3 packs, AnimatedNumber balance, "≈ N standard or M high previews".
- **Settings**: language picker (20, native names, `i18n.changeLanguage` + persisted +
  RTL note), notification toggles (previews/offers/reminders), haptics, Restore purchases,
  Manage subscription (store deep link), Delete all my data (wipes journey + files; confirm),
  Delete account (`deleteAccount`), Export journey report (Pro), Privacy/Terms/Support
  (`legal/[doc]` in-app + external URL from config), app version, replay onboarding,
  developer entry (hidden in production builds; visible with mock mode).
- **Consent** copy names **fal.ai** (image processing) and **OpenAI-family image models**
  as processed via fal — text from `consent.*` keys; version `CONSENT_VERSION`.

## 7. Backend port (owner: backend-app)

`src/services/backend/types.ts` is the contract (already updated). Mock server implements:
anonymous auth, wallet (starting 0 credits, `previewUsed` false), `createPreview` with all
server rules (consent, credit reserve/refund, idempotency, free onboarding preview, free-high
token, rate limit) and a simulated pipeline (queued → processing with progress → finalizing
→ succeeded in ~4 s; result = the source photo with a copper tint overlay generated by
`expo-image-manipulator` on native, canvas on web is optional — a deterministic tint
placeholder image path is acceptable; a failure switch in the developer screen), gift wheel,
cohort counts, entitlement from `mockStore`. `mockStore` offerings: default (weekly, monthly,
annual), gift_discount (annual gift), credits (3 packs) with **localized-style price
strings** and no trial. `live.native.ts` mirrors the same ports on `@react-native-firebase`.
`session.ts` bootstraps as in Belto plus journey reminders re-scheduling on foreground.
`notifications.ts` exports (contract used by the layout):
`NotificationTap = {type:'preview_ready',previewId} | {type:'offer'} | {type:'gift_expiring'} |
{type:'phase',phase:PhaseId} | {type:'photo_due'} | {type:'shed'}`, `onNotificationTap`,
`configureNotificationHandling`, `getPermissionState`, `requestPermission(source)`,
`registerPushToken`, `scheduleJourneyReminders(input)`, `cancelJourneyReminders()`,
`notifyPreviewReady(id)`, `scheduleGiftReminder`, `cancelGiftReminder`.

## 8. Functions (owner: functions)

Adapt Belto's functions to `@shared/*`: callables `createPreview`, `cancelPreview`,
`deletePreview`, `reportPreview`, `spinGiftWheel`, `recordConsent`, `joinCohort`, `getCohort`,
`deleteAccount`; HTTP `revenuecatWebhook` (plans weekly/monthly/annual + packs, idempotent
on event id, `PLAN_ALLOWANCE`), `falWebhook`; scheduled `hourlyMaintenance` (30-day selfie
deletion, weekly annual allowance, stale reservation refund, cohort aggregation), task
`finalizePreview`. Provider: fal queue for an image edit endpoint chosen by config
(`config/runtime.imageModelQueueURL`, default `openai/gpt-image-2/edit`, host pinned to
`queue.fal.run`), prompt architecture from the Simetra evidence: short identity guard +
PRIMARY CHANGE / PRESERVE / AVOID per style + intensity line; result composited back
outside the edit mask when `regionHint` is present; quality gate measures changed pixels
inside the mask and retries once at the same charge; watermark on the free onboarding
preview; never store raw provider payloads; auto-refund every failure; kill switch
`generationEnabled`. Prompts live only in `functions/src/lib/prompts.ts`.

## 9. Localization

`src/translations/<locale>/<namespace>.json`; the file name is the top-level key. Namespaces:
`common, nav, errorBoundary, errors, onboarding, paywall, gift, credits, consent, settings,
legal, journey, guide, capture, compare, shed, cohort, report, preview, notifications, ui,
toast`. Owners write **`en` and `tr`**; the other 18 are produced by translators afterwards
(`native/<locale>.json` holds iOS/Android permission strings). Rules: no hardcoded UI
strings (ESLint), typed keys (`generated.ts` from en), ICU-style plurals via `_one/_other`
(Arabic needs `_zero/_one/_two/_few/_many/_other` in translations), placeholders `{{name}}`
identical across locales, tone = calm and precise, never diagnostic. After adding files run
`npm run gen:i18n`. `npm run lint:translations:partial` passes while only en/tr exist.

## 10. Compliance guardrails (App Review, from the Simetra rejections)

**Copy rule (D-015):** never "on track", "exactly", "you are fine", "success", "guaranteed"; say "typical", "many people", "individual results vary". Previews and selfies are deleted 30 days after creation (D-014); the UI shows the date. HD (`high`) needs credits only (D-013). Journey reminders are local; phase and photo reminders are Pro and gated when the schedule is built.

AI consent names vendors; preview labelled "AI preview — not a prediction of your result";
no Norwood/diagnosis language; no graft counts or outcome promises; no fake social proof or
fabricated numbers; account/data deletion reachable in Settings; permissions explained by
custom strings; subscription disclosure adjacent to the CTA; band chart says "typical range,
individual results vary"; medical red-flag copy always says "contact your clinic or a doctor".

## 11. Definition of done (each owner, before reporting)

`npx tsc --noEmit` clean for owned files, `npx eslint <owned paths> --max-warnings=0`,
`npm run lint:translations:partial`, jest tests for pure logic (TDD for `entitlements`,
reminder scheduling, mock server rules, capture gate, prompts, ledger), every screen has
loading/empty/error/offline states, accessibility labels, RTL-safe styles (`start/end`,
no left/right), Reduce Motion path, analytics events from `services/analytics.ts`, and a
short report of files changed. No new dependencies without telling the lead.

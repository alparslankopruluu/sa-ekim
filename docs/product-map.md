# Product Map — Kök

*Canonical owner for planned user journeys, screen inventory, UI states, and testable acceptance criteria. Keep it compact; implementation detail belongs in code and architecture.*

## Core job and loop

- **Job to be done:** Get through the 12–18-month hair-restoration wait knowing what is normal this week and whether the photos show progress
- **Trigger → action → result → repeat:** Trigger (photo day / phase change / week-3 worry) → capture same-angle photo or log shed → see phase, band and comparison → reassured, next task → return next week
- **Activation moment:** Setting day 0 and seeing 'Day N · Week W — what is normal now' on Today
- **Gotcha/billboard screen:** Today: the phase card with the band and 'you are here' over the user's own week (and the preview wipe for acquisition) <!-- the one screen designed to be watched inside someone else's phone video; see docs/playbooks/product-strategy.md -->
- **Real-device quality proof:** Real-device capture with the upright gate and ghost overlay across two consecutive weeks; real-photo preview QA of the masked edit before launch

## Journey

```text
Install → welcome → goal → stage → operation date → (photo → consent → free watermarked preview → reveal) → notification priming → paywall (annual/monthly/weekly, no trial)
→ Today (day/phase/next task) → weekly capture with ghost overlay → Journey tab (timeline, photos, plan) → Compare (Pro) / Shed log / Guide → reminders bring the user back
Before an operation: Previews tab → style picker → consent → photo → progress → result wipe → save/share; out of credits → credits store or paywall
```

## Screen inventory

| Screen / route | User value | Entry → exit | Primary action | Required states | Motion / feedback | Analytics | Accessibility | Acceptance evidence |
|---|---|---|---|---|---|---|---|---|
| onboarding | first value, personalization, priming, first preview | install → paywall | Continue / Allow / Skip | loading · error · offline · permission · skip paths | staggered slide, ring, confetti, wipe | `onboarding_step_<n>` | labelled steps, Dynamic Type safe CTA, RTL | mock run through all 8 steps |
| Today `(tabs)/index` **(gotcha)** | knows day/week/phase and what is normal; next task | tabs → capture/shed/guide/paywall | Do the next task | before-date · loading · error · offline · Pro-locked band | ring fill, staggered cards | `phase_view` | chart text alternative | day/phase vectors + screenshot |
| Journey `(tabs)/journey` | timeline, photo series, plan | tabs → guide/photo/compare/capture | Add photo | empty · limit-reached (paywall) · error | rail highlight, grid entrance | `feature_locked` | grid labels | free-limit test |
| capture | consistent same-angle photo | Today/Journey → back | Shutter (when upright) | permission denied · web · gate blocked | ghost overlay, level ring, shutter flash | `photo_captured`, `capture_gate_blocked` | level announced | gate unit tests + device run |
| compare | see progress side by side | Journey/photo → share | Slide / share | locked · <2 photos · error | wipe gesture | `compare_open` | adjustable role | wipe unit + screenshot |
| shed | log and see shedding vs phase window | Today → back | Save count | empty · invalid · error | bar entrance | `shed_logged` | numeric field labels | parse tests |
| journey-setup | set day 0, kind, clinic | Today → back | Save | invalid date · future date | sheet | `journey_setup`, `day0_set` | date wheel labels | date tests |
| photo/[id] | inspect/delete a photo | grid → back | Delete/Compare | missing file | zoom | `photo_deleted` | labels | delete test |
| guide/[phase] | education per phase, red flags | Today/Journey → back | Read | locked (title stays visible) | accordion | `phase_view` | headings | content review |
| Previews `(tabs)/previews` | saved/in-flight previews | tabs → picker/result | New preview | empty · loading · error · in-flight · failed | badge, grid | `preview_start` | card labels | list states |
| preview/index | choose style, density, quality, photo | → consent → rendering | Create preview | needs consent/credits/photo | selection spring, shine | `style_selected`, `generate_tap` | radio roles | flow tests |
| preview/rendering | honest progress, cancel/retry | → result | Cancel | failure · offline · refunded | ring | `core_action_preview` | live status | mock pipeline run |
| preview/result | before/after wipe, save/share/report | → tabs | Save / Share | watermarked · demo tag · error | wipe, confetti | `result_view`, `preview_saved` | adjustable, AI label | screenshot |
| paywall | convert without pressure | onboarding/locks → back | Continue | loading · failed · empty · pending | shine, plan glow, confetti | `paywall_view`, `purchase` | radio roles, price labels | mock purchase tests |
| gift | one honest spin | home/exit → paywall | Spin | already-spun · expired · error | wheel physics, haptics | `gift_wheel_*` | prize read-out | wheel unit tests |
| credits | top up previews | settings/preview → back | Buy pack | loading · failed | count-up | `credits_store_view` | labels | mock purchase |
| settings | control language, notifications, data, legal | tabs | Toggle / delete | confirm sheets · error | subtle | — | labels | delete-data test |
| consent / report / legal / developer / update | compliance and support | modal | Accept / Send | error · offline | subtle | `consent_accepted`, `content_reported` | labels | consent copy check |

Mark exactly one row as the gotcha screen; acquires/retains classification stays at
milestone level (`docs/mvp-plan.md`), not per screen.
Required states must be explicit for every core, onboarding, result, paywall, settings,
and necessary helper screen. Mark a state `N/A` only with a short reason.
Document motion/haptic intent only where it helps feedback or understanding; repeated
actions may explicitly say `instant/subtle`.

## Scope integrity

- Every M1 task maps to a row above and a measurable user outcome.
- Any screen not required by the approved core journey goes to `docs/backlog.md`.
- No mandatory login unless the core value or cross-device ownership requires it.
- Store screenshot claims must map to shipped rows in `docs/features.md` and the uploaded build.

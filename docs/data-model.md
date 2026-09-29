# Data model — Firestore, Storage, Functions

*Living doc. Every collection, its access rule in one line, its indexes and retention. Update with
EVERY schema/rules/index change. Contracts live in `functions/src/shared/api.ts`; paths in
`functions/src/lib/paths.ts`. Nothing here is deployed by agents.*

## Firestore collections

| Path | Key fields | Client access | Written by | Retention |
|---|---|---|---|---|
| `users/{uid}` | `locale`, `goal`, `stage`, `onboardingVariant`, `createdAt` (server time) | owner get/create/update (shape-checked, no money/entitlement fields); no delete | app | until account deletion |
| `users/{uid}/devices/{deviceId}` | `token`, `platform` (ios/android/web), `topics` ⊂ previews/offers/reminders, `locale`, `updatedAt` | owner read/write/delete (shape-checked) | app | stale FCM tokens removed on send; account deletion |
| `users/{uid}/private/wallet` | `WalletDoc` `{balance, freeHighTokens, previewUsed, updatedAt}` | owner get | Functions only | account deletion |
| `users/{uid}/private/gift` | `GiftDoc` + server-only `tokenExpiresAt` (set only while an unredeemed freeHigh token exists) | owner get | `spinGiftWheel`, `createPreview`, RC webhook, maintenance | account deletion |
| `users/{uid}/private/consent` | `{version, acceptedAt}` (AI-processing disclosure naming the vendors) | owner get | `recordConsent` | account deletion |
| `users/{uid}/private/entitlement` | `pro`, `plan`, `productId`, `expiresAt`, `store`, `environment`, `lastEventAt`, annual schedule `allowanceAnchorAt`/`allowanceWeek`/`nextAllowanceAt` | owner get | `revenuecatWebhook`, maintenance | account deletion |
| `users/{uid}/previews/{previewId}` | `PreviewDoc` (status, goal, styleId, density, quality, progress, reserved/chargedCredits, photoPath, resultPath, watermarked, onboarding, errorCode, createdAt, updatedAt, **expiresAt** = createdAt + 30 d) | owner read | Functions only | deleted with its images after `expiresAt`, by `deletePreview`, or account deletion |
| `users/{uid}/previews_private/{previewId}` | fal `requestId`/`cancelUrl`, `charge`, `idempotencyKey`, `regionHint`, `promptVersion`, `modelId`, `attempt`, `retried`, `changedFraction`, transient `outputUrl`, timestamps. **No prompt text, no provider payload.** | none | Functions only | deleted with the preview |
| `users/{uid}/ledger/{autoId}` | `{delta, reason, refId, createdAt}` append-only | owner read | Functions only | account deletion |
| `users/{uid}/requests/{idempotencyKey}` | `{kind:'createPreview', status, refId, response, errorCode, createdAt, updatedAt, expireAt}` | none | `createPreview`, maintenance | **7-day TTL** on `expireAt` |
| `users/{uid}/rc_events/{eventId}` | `{type, credits, processedAt}` (idempotency of RevenueCat events) | none | `revenuecatWebhook` | account deletion |
| `cohortMembers/{uid}` | `{procedureDate (YYYY-MM-DD), goal, kind, joinedAt}` — nothing else (no photos, names, clinic) | none | `joinCohort` | account deletion |
| `reports/{autoId}` | `{uid, previewId, reason, status:'open', createdAt}` — reason code only, no free text | none | `reportPreview` | human review ≤ 48 h; account deletion removes the user's reports |
| `config/runtime` | `generationEnabled` (kill switch, missing = enabled, 60 s cache), `imageModelQueueURL` (host-pinned to `https://queue.fal.run/…`, invalid → default `openai/gpt-image-2/edit`) | none | owner (console/Admin) | — |
| `config/wheel` | `weights` per prize id (invalid entries fall back to `@shared/wheel` defaults) | none | owner (console/Admin) | — |

Rules: deny by default (`match /{document=**} { allow read, write: if false; }`); ownership is
`request.auth.uid == uid`; server-only collections have no client write rule at all. IDOR
negatives for every owner resource are in `firestore-tests/rules.test.mjs`.

## Storage

| Path | Access | Written by | Retention |
|---|---|---|---|
| `uploads/{uid}/{name}.jpg\|jpeg\|png\|heic` | owner create (new object only, `image/*`, 1 B–10 MB, plain name), get, delete | app | 30 days (hourly sweep), `deletePreview`, account deletion |
| `users/{uid}/previews/{previewId}.jpg` | owner get | `finalizePreview` | with the PreviewDoc (30 days) |
| everything else | denied | — | — |

The server re-checks every referenced upload (exists, `image/jpeg|png|webp`, ≤ 10 MB) before any
credit moves; HEIC passes the rule but is refused by the server (no HEIC decoder) — the app
converts to JPEG.

## Indexes required by the queries

`firestore.indexes.json` holds exactly these entries (updated by the lead 2026-09-29):

| Scope | Collection | Fields | Used by |
|---|---|---|---|
| collection group | `previews` | `status` ASC, `createdAt` ASC | stuck-preview sweep |
| collection group | `requests` | `status` ASC, `createdAt` ASC | stale-reservation sweep |
| collection | `cohortMembers` | `goal` ASC, `procedureDate` ASC | `getCohort` sameGoal count |
| field override (collection group, ASC) | `previews.expiresAt` | — | 30-day retention sweep |
| field override (collection group, ASC) | `private.nextAllowanceAt` | — | annual weekly top-up |
| field override (collection group, ASC) | `private.tokenExpiresAt` | — | gift-token expiry |
| TTL | `requests.expireAt` | — | 7-day idempotency record retention |

Automatic single-field indexes cover the rest (`previews.status in`, `previews.createdAt >=` count,
`previews.photoPath ==`, `cohortMembers.procedureDate` range count, `reports.uid`/`previewId`).

## Cloud Functions

| Function | Trigger | Purpose |
|---|---|---|
| `createPreview` | callable (App Check) | validate → one transaction (replay, consent, kill switch, 10/h + 2 active, free onboarding preview or reserve `previewCost` or a freeHigh token) → padded canvas + mask → fal queue with HMAC webhook; any failure before fal accepts refunds everything |
| `cancelPreview` | callable | queued/processing → canceled, full refund, best-effort fal cancel |
| `deletePreview` | callable | terminal previews only: result image, selfie (if unshared), docs |
| `reportPreview` | callable | `reports/{autoId}` (one per user + preview) |
| `recordConsent` | callable | stores the accepted disclosure version (monotonic) |
| `spinGiftWheel` | callable | server draw, one spin per account, 3-day expiry; credits now, freeHigh token to wallet, discount40 = gift doc unlocks `gift_discount` |
| `joinCohort` / `getCohort` | callable | minimal member doc / real `count()` numbers only (sameWeek = Mon–Sun calendar week, sameGoal = ±14 days) |
| `deleteAccount` | callable | Storage prefixes, cohort doc, own reports, `users/{uid}` recursively, Auth user (RevenueCat customer deletion is owner-side) |
| `falWebhook` | HTTPS (public) | per-preview HMAC token + fal ED25519 signature → claim + enqueue `finalizePreview`, or fail + refund |
| `finalizePreview` | Cloud Tasks | download → quality gate (changed pixels inside the mask; one same-charge retry under 2%) → composite originals outside the mask → watermark (free onboarding only) → store JPEG → settle → push |
| `revenuecatWebhook` | HTTPS (public) | Authorization-header check, idempotent on event id, PLAN_ALLOWANCE grants (weekly/monthly; annual `initial`), packs 10/25/60, entitlement mirror, gift redemption |
| `hourlyMaintenance` | schedule (hourly) | stuck refunds, stale reservation refunds, 30-day deletion of selfies + results + PreviewDocs, annual weekly top-up, gift-token expiry |

Secrets (Secret Manager): `FAL_KEY`, `FAL_WEBHOOK_TOKEN_SALT`, `REVENUECAT_WEBHOOK_AUTH`.

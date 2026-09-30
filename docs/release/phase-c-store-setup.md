# Phase C — store, billing and backend setup (prepared, NOT applied)

Nothing in this file has been executed. Every step that writes to an external account (Apple,
Google, RevenueCat, Firebase, Cloudflare, EAS) needs the product owner's explicit approval, one
approval per write (AGENTS.md §4). Order matters: identifiers first, catalog second, keys last.

## 1. Identifiers (one-way doors — confirm first)

| Item | Value | Source |
|---|---|---|
| App name | Kök — store name "Kök: Hair Transplant Tracker" (bare "KÖK" is taken on the App Store); screen done, attorney clearance pending | D-001, D-018 |
| Bundle ID / Android package | `com.techtactoe.kok` | `app.config.ts` |
| URL scheme | `kok` | `app.config.ts` |
| Apple team | from `~/.config/app-factory/operator.json` | operator profile |
| Firebase projects | `kok-dev`, `kok-prod` (us-central1) | D-001 |
| RevenueCat project | new project "Kök", entitlement `pro` | products.ts |

## 2. Product catalog (must match `functions/src/shared/products.ts` and `pricing.ts`)

| Store product id | Type | USD reference tier | RC package | Grants |
|---|---|---|---|---|
| `com.techtactoe.kok.pro.weekly` | auto-renewable, 1 week | $7.99 | `$rc_weekly` (offering `default`) | `pro` + 12 credits per renewal |
| `com.techtactoe.kok.pro.monthly` | auto-renewable, 1 month | $12.99 | `$rc_monthly` (offering `default`) | `pro` + 24 credits per renewal |
| `com.techtactoe.kok.pro.annual` | auto-renewable, 1 year | $39.99 | `$rc_annual` (offering `default`) | `pro` + 10 credits at purchase, then 6/week |
| `com.techtactoe.kok.pro.annual.gift` | same group, intro price for the first year | $23.99 (40% off) | `$rc_annual` in offering `gift_discount` | as annual |
| `com.techtactoe.kok.credits_10` | consumable | $4.99 | offering `credits` | 10 credits |
| `com.techtactoe.kok.credits_25` | consumable | $9.99 | offering `credits` | 25 credits |
| `com.techtactoe.kok.credits_60` | consumable | $19.99 | offering `credits` | 60 credits |

Rules: **no free trial and no introductory free period on any product**. One subscription group
"Kök Pro" (weekly, monthly, annual, annual.gift ordered by level). Price tiers for other
storefronts are set with the `asc-ppp-pricing` skill (priority: TR, SA, AE, EG, IQ, IN, ID, BR, MX,
US, GB, DE); review the proposed price table before applying. Play: subscription `pro` with base
plans `weekly`, `monthly`, `annual`, `annual-gift` (offer) and consumables `credits_10|25|60`
(the Belto `scripts/play/create-products.js` pattern applies; requires a Play service account
the owner provides — never committed).

RevenueCat: entitlement `pro` → weekly, monthly, annual, annual.gift. Offerings `default`,
`gift_discount`, `credits`. ASC `productId` must equal RC `store_identifier`. Use the
`asc-revenuecat-catalog-sync` skill: audit → owner-approved apply → readback. Webhook URL =
the deployed `revenuecatWebhook` function with header secret `REVENUECAT_WEBHOOK_AUTH`.

## 3. Backend (phase B artifacts, deploy only with approval)

```bash
# Owner runs these in their own terminal after reviewing the diff; the agent never deploys.
firebase projects:create kok-dev            # and kok-prod
firebase use --add                          # aliases dev / prod (.firebaserc exists)
cd functions && npm ci && npm run build && npm test
firebase functions:secrets:set FAL_KEY --project kok-dev
firebase functions:secrets:set FAL_WEBHOOK_TOKEN_SALT --project kok-dev
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH --project kok-dev
firebase deploy --only firestore:rules,storage,functions --project kok-dev   # never a bare `firebase deploy`
```

Then register iOS/Android apps, download `GoogleService-Info.plist` / `google-services.json`
(gitignored), enable Anonymous Auth, App Check (App Attest / Play Integrity), Remote Config
defaults from `src/services/remoteDefaults.ts`, and set `config/runtime.generationEnabled`.
Run the real-photo QA of the masked preview (see PRODUCT.md risk 2) on a dev build before any
store submission; do not ship the preview if identity drifts or the edit is invisible.

## 4. Build and distribute

```bash
npm run verify
eas build -p ios --profile development       # dev client for simulators/devices
eas build -p ios --profile production        # after the catalog and keys exist
asc publish testflight --app "$ASC_APP_ID" --ipa .asc/artifacts/Kok.ipa --group "Internal" --wait
eas build -p android --profile production    # AAB for Play Internal Testing
```

The kit's `factoryctl doctor` currently fails on: `asc` 4.0.0 (kit wants >=3.1.0,<4), `maestro`
missing, free disk below 30 GiB. Resolve before `/ship`. Review submission stays a separate human
approval.

## 5. App Review notes (paste into ASC; adjust after the first TestFlight)

- No account is required. The app uses anonymous authentication.
- To test everything except the AI preview: complete onboarding (the photo step can be skipped),
  set an operation date, open Today, capture a progress photo with the camera or choose one from
  the library, open Journey, Compare, Shed log and the phase guide.
- To test the AI preview: use your own photo (a selfie is enough). The consent screen names the
  AI processors (fal.ai with OpenAI image models). Photos are deleted within 30 days and can be
  deleted immediately in Settings → Delete all my data / Delete account.
- The app is not a medical device. It never diagnoses, and the preview is labelled
  "AI preview — not a prediction of your result". Phase text describes what is typical in clinic
  timelines and always tells users to follow their clinic's advice and to contact a doctor for
  warning signs.
- Subscriptions: weekly, monthly and annual auto-renewing plans, no free trial. Restore
  Purchases, Terms and Privacy links are on the paywall.

## 6. Store listing and creative (after M1/M2 acceptance)

Use `/store-assets`: 20 locales, first screenshots "See what's typical for your week of recovery"
and "Shedding in week 3? See what's typical" (copy rule D-015), real app states only, AI label on
any preview imagery, no before/after promises. Keywords in TR, AR, EN first; verify popularity in
Apple Search Ads before locking.

## 7. Human checklist before the first submission

1. Confirm name, bundle ID, prices, and locale list (D-001, D-003, D-006).
2. Native-speaker review of the 18 translated locales (esp. AR, TR, DE, JA, ZH).
3. Legal review of the privacy policy, terms and the AI consent text.
4. Real-device QA: capture gate, ghost overlay, reminders across a week, preview identity QA.
5. Sandbox purchase and Restore for all seven products on iOS and Android.
6. Rotate any credential shown in a terminal; run the repo history secret scan.
